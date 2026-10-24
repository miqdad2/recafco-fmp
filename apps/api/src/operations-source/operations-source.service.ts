import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ModuleIdentifier, Prisma } from '@recafco/database';
import {
  evaluateProjectMatches,
  normalizeFactoryCode,
  normalizeJobOrder,
  type MatchCandidate,
  type MatchContract,
  type MatchState,
} from '@recafco/shared';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import { DEMO_PROJECT_ID_PREFIX, operationsDemoAllowed } from './demo-guard';
import {
  asChanges,
  buildConnectionView,
  buildProgressView,
  computeStaleness,
  fingerprintOf,
  summarizeProgress,
  type ConnectionView,
  type ProgressSummary,
  type ProgressView,
  type ProjectRow,
  type SnapshotRow,
  type StatusRow,
} from './operations-source.view';
import type { LinkSourceProjectDto, RegisterSourceProjectDto, SetFactoryMappingDto, UnlinkSourceProjectDto } from './dto/operations-source.dto';

/** One Refresh per project at most this often, however many viewers press it. */
export const MIN_REFRESH_GAP_SECONDS = 15;
export const MAX_MONITORING_IDS = 100;
const MAX_CONTRACTS_FOR_MATCHING = 3000;

export type RefreshStatus = 'QUEUED' | 'ALREADY_QUEUED' | 'TOO_SOON' | 'NOT_ACTIVE' | 'NOT_LINKED';

export interface RefreshResult {
  status: RefreshStatus;
  message: string;
}

export interface ProjectListItem {
  id: string;
  sourceProjectId: string;
  jobOrder: string | null;
  factory: string | null;
  name: string | null;
  contract: { id: string; referenceNumber: string; title: string } | null;
  linkMethod: 'MANUAL' | 'AUTOMATIC' | null;
  linkedAt: string | null;
  linkedByName: string | null;
  lastSuccessfulRetrievalAt: string | null;
  sourceGeneratedAt: string | null;
  lastOutcome: string | null;
  lastErrorMessage: string | null;
  stale: boolean;
  hasData: boolean;
  syncEnabled: boolean;
  /** Why the project is excluded from linking/sync (training / test / no factory ...), or null. */
  excludedReason: string | null;
  missingFromListSince: string | null;
}

export interface ProjectMatchItem {
  project: ProjectListItem;
  state: MatchState;
  summary: string;
  candidates: MatchCandidate[];
}

export interface ProjectsOverview {
  connection: ConnectionView;
  linked: ProjectListItem[];
  suggested: ProjectMatchItem[];
  conflicts: ProjectMatchItem[];
  awaiting: ProjectMatchItem[];
  /** Training/test/unclassified projects found by discovery. Never suggested, linked or reported. */
  excluded: ProjectListItem[];
  factoryMappings: { id: string; factoryCode: string; plant: { id: string; code: string; name: string } }[];
  /** Factory codes the source has reported that no plant is mapped to yet (automatic linking cannot use them). */
  unmappedFactories: string[];
  /** Honest statement about discovery: there is no verified project-list API or creation notification. */
  discovery: { automatic: boolean; reason: string };
}

const PROJECT_SELECT = {
  id: true,
  sourceProjectId: true,
  sourceCode: true,
  jobOrderNormalized: true,
  factoryCode: true,
  sourceName: true,
  contractId: true,
  linkMethod: true,
  linkedAt: true,
  linkedByName: true,
  syncEnabled: true,
  lastGeneratedAt: true,
  lastAttemptAt: true,
  lastSuccessAt: true,
  lastOutcome: true,
  lastErrorMessage: true,
  consecutiveFailures: true,
  refreshRequestedAt: true,
  currentSnapshotId: true,
  excludedReason: true,
  missingFromListSince: true,
} as const;

type ProjectRecord = Prisma.OperationsSourceProjectGetPayload<{ select: typeof PROJECT_SELECT }>;

const DISCOVERY_OFF_NOTE =
  'Automatic discovery is available but switched off. When enabled, FMP reads the source project list and links unique job-order + factory matches. Until then known project ids are registered manually.';

function toProjectRow(p: ProjectRecord): ProjectRow {
  return {
    id: p.id,
    sourceProjectId: p.sourceProjectId,
    sourceCode: p.sourceCode,
    jobOrderNormalized: p.jobOrderNormalized,
    factoryCode: p.factoryCode,
    sourceName: p.sourceName,
    contractId: p.contractId,
    linkMethod: p.linkMethod,
    linkedAt: p.linkedAt,
    linkedByName: p.linkedByName,
    syncEnabled: p.syncEnabled,
    lastGeneratedAt: p.lastGeneratedAt,
    lastAttemptAt: p.lastAttemptAt,
    lastSuccessAt: p.lastSuccessAt,
    lastOutcome: p.lastOutcome,
    lastErrorMessage: p.lastErrorMessage,
    consecutiveFailures: p.consecutiveFailures,
    refreshRequestedAt: p.refreshRequestedAt,
    excludedReason: p.excludedReason,
    missingFromListSince: p.missingFromListSince,
  };
}

@Injectable()
export class OperationsSourceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  private now(): Date {
    return new Date();
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async getConnection(): Promise<ConnectionView> {
    const row = await this.db.getClient().operationsSourceStatus.findUnique({ where: { id: 'default' } });
    return buildConnectionView(row as StatusRow | null, this.now());
  }

  // ---------------------------------------------------------------------------
  // Per-contract progress (reads accepted LOCAL data only)
  // ---------------------------------------------------------------------------

  async getContractProgress(contractId: string, actor: AuthUser): Promise<ProgressView> {
    const contract = await this.loadAccessibleContract(contractId, actor);
    const views = await this.resolveViews([contract]);
    const view = views.get(contractId);
    if (!view) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    return view;
  }

  /**
   * THE shared resolver. The Contract List, the Overview and the four department tabs all read their operational
   * information from here (the list through summarizeProgress, which derives from the same view), so they always
   * agree. It reads accepted LOCAL snapshots only; it never contacts the source and never falls back to the old
   * local workflow figures.
   */
  private async resolveViews(contracts: { id: string; jobOrder: string | null; plantId: string | null }[]): Promise<Map<string, ProgressView>> {
    const db = this.db.getClient();
    const ids = contracts.map((c) => c.id);
    const result = new Map<string, ProgressView>();
    if (ids.length === 0) return result;
    const [projects, mappings, connection] = await Promise.all([
      db.operationsSourceProject.findMany({ where: { contractId: { in: ids } }, select: PROJECT_SELECT }),
      db.operationsFactoryMapping.findMany({ select: { factoryCode: true, plantId: true } }),
      this.getConnection(),
    ]);
    const snapshotIds = projects.map((p) => p.currentSnapshotId).filter((x): x is string => x !== null);
    const snapshots =
      snapshotIds.length > 0 ? await db.operationsProgressSnapshot.findMany({ where: { id: { in: snapshotIds } } }) : [];
    const snapshotById = new Map(snapshots.map((x) => [x.id, x as unknown as SnapshotRow]));
    const projectByContract = new Map(projects.map((p) => [p.contractId as string, p]));
    const factoryByPlant = new Map(mappings.map((m) => [m.plantId, m.factoryCode]));
    const now = this.now();
    const demoAllowed = operationsDemoAllowed();
    for (const c of contracts) {
      const project = projectByContract.get(c.id) ?? null;
      result.set(
        c.id,
        buildProgressView({
          contractId: c.id,
          project: project ? toProjectRow(project) : null,
          snapshot: project?.currentSnapshotId ? (snapshotById.get(project.currentSnapshotId) ?? null) : null,
          contract: { jobOrder: c.jobOrder, factoryCode: c.plantId ? (factoryByPlant.get(c.plantId) ?? null) : null },
          connection,
          now,
          demoAllowed,
        }),
      );
    }
    return result;
  }

  /** Contracts among `ids` the viewer may see (silently drops the rest, like the contract list does). */
  private async accessibleContracts(ids: string[], actor: AuthUser): Promise<{ id: string; jobOrder: string | null; plantId: string | null }[]> {
    const unique = [...new Set(ids)].slice(0, MAX_MONITORING_IDS);
    if (unique.length === 0) return [];
    const [rows, deptFilter] = await Promise.all([
      this.db.getClient().contract.findMany({ where: { id: { in: unique } }, select: { id: true, jobOrder: true, plantId: true, departmentId: true } }),
      this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT),
    ]);
    return rows.filter((c) => c.departmentId === null || deptFilter === null || deptFilter.in.includes(c.departmentId));
  }

  /** Compact per-contract summaries for the Contract List (one call for the whole page). */
  async monitoringSummaries(ids: string[], actor: AuthUser): Promise<Record<string, ProgressSummary>> {
    const contracts = await this.accessibleContracts(ids, actor);
    const views = await this.resolveViews(contracts);
    const out: Record<string, ProgressSummary> = {};
    for (const [id, view] of views) out[id] = summarizeProgress(view);
    return out;
  }

  /** Cheap change-detector for open screens: it changes only when what a viewer would see changes. */
  async monitoringFingerprints(ids: string[], actor: AuthUser): Promise<Record<string, string>> {
    const contracts = await this.accessibleContracts(ids, actor);
    const views = await this.resolveViews(contracts);
    const out: Record<string, string> = {};
    for (const [id, view] of views) out[id] = fingerprintOf(view);
    return out;
  }

  async getContractHistory(contractId: string, actor: AuthUser, limit = 30): Promise<unknown[]> {
    await this.loadAccessibleContract(contractId, actor);
    const project = await this.db.getClient().operationsSourceProject.findUnique({ where: { contractId }, select: { id: true } });
    if (!project) return [];
    const rows = await this.db.getClient().operationsProgressSnapshot.findMany({
      where: { projectId: project.id },
      orderBy: { generatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((r) => ({
      id: r.id,
      origin: r.origin,
      sourceGeneratedAt: r.generatedAt.toISOString(),
      retrievedAt: r.retrievedAt.toISOString(),
      totals: { total: r.total, issued: r.issued, produced: r.produced, delivered: r.delivered, installed: r.installed, pendingInputs: r.pendingInputs },
      changes: asChanges(r.changes),
      flags: Array.isArray(r.flags) ? r.flags : [],
    }));
  }

  /**
   * Refresh = ask the BACKGROUND worker to look again soon. The viewer never triggers an external call, and
   * many viewers collapse into at most one queued request per project per MIN_REFRESH_GAP_SECONDS.
   */
  async requestRefresh(contractId: string, actor: AuthUser): Promise<RefreshResult> {
    await this.loadAccessibleContract(contractId, actor);
    const project = await this.db.getClient().operationsSourceProject.findUnique({ where: { contractId }, select: PROJECT_SELECT });
    if (!project) return { status: 'NOT_LINKED', message: 'This contract is not linked to an Operations project.' };

    const connection = await this.getConnection();
    if (!connection.liveSyncActive || !project.syncEnabled) {
      return { status: 'NOT_ACTIVE', message: 'Live synchronization is not active, so there is nothing to refresh. ' + connection.message };
    }

    const now = this.now();
    const updated = await this.db.getClient().$executeRaw`
      UPDATE operations_source_projects
         SET refresh_requested_at = ${now}, refresh_requested_by_user_id = ${actor.id}::uuid
       WHERE id = ${project.id}::uuid
         AND sync_enabled = true
         AND (refresh_requested_at IS NULL OR (last_attempt_at IS NOT NULL AND refresh_requested_at <= last_attempt_at))
         AND (last_attempt_at IS NULL OR last_attempt_at <= ${now}::timestamptz - make_interval(secs => ${MIN_REFRESH_GAP_SECONDS}))
    `;
    if (updated > 0) {
      return { status: 'QUEUED', message: 'A refresh was requested. Updated figures appear here once the background service has retrieved them.' };
    }
    const pending = project.refreshRequestedAt !== null && (project.lastAttemptAt === null || project.refreshRequestedAt > project.lastAttemptAt);
    return pending
      ? { status: 'ALREADY_QUEUED', message: 'A refresh is already waiting for the background service.' }
      : { status: 'TOO_SOON', message: 'The figures were checked a moment ago. Please try again shortly.' };
  }

  // ---------------------------------------------------------------------------
  // Project overview: linked / suggested / conflicts / awaiting
  // ---------------------------------------------------------------------------

  async listProjects(actor: AuthUser): Promise<ProjectsOverview> {
    const db = this.db.getClient();
    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const canSee = (deptId: string | null): boolean => deptId === null || deptFilter === null || deptFilter.in.includes(deptId);

    const [projects, mappings, contracts, connection] = await Promise.all([
      db.operationsSourceProject.findMany({ where: { NOT: { sourceProjectId: { startsWith: DEMO_PROJECT_ID_PREFIX } } }, select: PROJECT_SELECT, orderBy: { createdAt: 'asc' } }),
      db.operationsFactoryMapping.findMany({ include: { plant: { select: { id: true, code: true, name: true } } }, orderBy: { factoryCode: 'asc' } }),
      db.contract.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          counterpartyName: true,
          jobOrder: true,
          status: true,
          plantId: true,
          departmentId: true,
          operationsSourceProject: { select: { sourceProjectId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_CONTRACTS_FOR_MATCHING,
      }),
      this.getConnection(),
    ]);

    const factoryByPlant = new Map(mappings.map((m) => [m.plantId, m.factoryCode]));
    const visibleContracts = contracts.filter((c) => canSee(c.departmentId));
    const contractById = new Map(visibleContracts.map((c) => [c.id, c]));
    const matchContracts: MatchContract[] = visibleContracts.map((c) => ({
      id: c.id,
      referenceNumber: c.referenceNumber,
      title: c.title,
      counterpartyName: c.counterpartyName,
      jobOrder: c.jobOrder,
      status: c.status,
      factoryCode: c.plantId ? (factoryByPlant.get(c.plantId) ?? null) : null,
      linkedSourceProjectId: c.operationsSourceProject?.sourceProjectId ?? null,
    }));

    const identityCount = new Map<string, number>();
    for (const p of projects) {
      if (p.jobOrderNormalized !== null && !p.excludedReason) {
        const key = `${p.jobOrderNormalized}|${p.factoryCode ?? ''}`;
        identityCount.set(key, (identityCount.get(key) ?? 0) + 1);
      }
    }

    const now = this.now();
    const toItem = (p: ProjectRecord): ProjectListItem => {
      const c = p.contractId ? contractById.get(p.contractId) : undefined;
      const stale = computeStaleness(toProjectRow(p), connection, now).stale;
      return {
        id: p.id,
        sourceProjectId: p.sourceProjectId,
        jobOrder: p.sourceCode,
        factory: p.factoryCode,
        name: p.sourceName,
        contract: c ? { id: c.id, referenceNumber: c.referenceNumber, title: c.title } : null,
        linkMethod: p.linkMethod,
        linkedAt: p.linkedAt ? p.linkedAt.toISOString() : null,
        linkedByName: p.linkedByName,
        lastSuccessfulRetrievalAt: p.lastSuccessAt ? p.lastSuccessAt.toISOString() : null,
        sourceGeneratedAt: p.lastGeneratedAt ? p.lastGeneratedAt.toISOString() : null,
        lastOutcome: p.lastOutcome,
        lastErrorMessage: p.lastErrorMessage,
        stale,
        hasData: p.currentSnapshotId !== null,
        syncEnabled: p.syncEnabled,
        excludedReason: p.excludedReason,
        missingFromListSince: p.missingFromListSince ? p.missingFromListSince.toISOString() : null,
      };
    };

    const linked: ProjectListItem[] = [];
    const suggested: ProjectMatchItem[] = [];
    const conflicts: ProjectMatchItem[] = [];
    const awaiting: ProjectMatchItem[] = [];
    const excluded: ProjectListItem[] = [];

    for (const p of projects) {
      if (p.excludedReason && p.contractId === null) {
        excluded.push(toItem(p));
        continue;
      }
      if (p.contractId !== null) {
        // A link to a contract outside the viewer's department scope is not shown to them at all.
        if (contractById.has(p.contractId)) linked.push(toItem(p));
        continue;
      }
      const others = p.jobOrderNormalized !== null ? (identityCount.get(`${p.jobOrderNormalized}|${p.factoryCode ?? ''}`) ?? 1) - 1 : 0;
      const evaluation = evaluateProjectMatches(
        { sourceProjectId: p.sourceProjectId, jobOrderNormalized: p.jobOrderNormalized, factoryCode: p.factoryCode, sourceName: p.sourceName, contractId: null },
        matchContracts,
        others,
      );
      const item: ProjectMatchItem = { project: toItem(p), state: evaluation.state, summary: evaluation.summary, candidates: evaluation.candidates };
      if (evaluation.state === 'CONFLICT') conflicts.push(item);
      else if (evaluation.state === 'SUGGESTED' || evaluation.state === 'AUTO_LINKABLE') suggested.push(item);
      else awaiting.push(item);
    }

    const mapped = new Set(mappings.map((m) => m.factoryCode));
    const unmappedFactories = [...new Set(projects.map((p) => p.factoryCode).filter((f): f is string => f !== null && !mapped.has(f)))].sort();

    return {
      connection,
      linked,
      suggested,
      conflicts,
      awaiting,
      excluded,
      factoryMappings: mappings.map((m) => ({ id: m.id, factoryCode: m.factoryCode, plant: m.plant })),
      unmappedFactories,
      discovery: connection.discovery.enabled
        ? {
            automatic: true,
            reason: connection.discovery.message ? `Automatic discovery is on. Last result: ${connection.discovery.message}` : 'Automatic discovery is on; no result has been reported yet.',
          }
        : { automatic: false, reason: DISCOVERY_OFF_NOTE },
    };
  }

  // ---------------------------------------------------------------------------
  // Register / link / unlink (contracts.operations_link)
  // ---------------------------------------------------------------------------

  async registerProject(actor: AuthUser, dto: RegisterSourceProjectDto): Promise<{ id: string; created: boolean }> {
    const db = this.db.getClient();
    let created = false;
    let project = await db.operationsSourceProject.findUnique({ where: { sourceProjectId: dto.sourceProjectId }, select: { id: true } });
    if (!project) {
      try {
        project = await db.$transaction(async (tx) => {
          const row = await tx.operationsSourceProject.create({ data: { sourceProjectId: dto.sourceProjectId }, select: { id: true } });
          await tx.operationsProjectLinkEvent.create({
            data: {
              projectId: row.id,
              action: 'REGISTERED',
              actorUserId: actor.id,
              actorName: actor.displayName,
              reason: dto.reason ?? null,
              details: { sourceProjectId: dto.sourceProjectId } as never,
            },
          });
          return row;
        });
        created = true;
      } catch (err) {
        if (isUniqueViolation(err)) {
          project = await db.operationsSourceProject.findUnique({ where: { sourceProjectId: dto.sourceProjectId }, select: { id: true } });
        } else {
          throw err;
        }
      }
    }
    if (!project) throw new NotFoundException({ code: 'SOURCE_PROJECT_NOT_FOUND', message: 'Source project could not be registered' });
    if (dto.contractId) await this.linkProject(actor, project.id, { contractId: dto.contractId, ...(dto.reason ? { reason: dto.reason } : {}) });
    return { id: project.id, created };
  }

  async linkProject(actor: AuthUser, projectId: string, dto: LinkSourceProjectDto): Promise<{ id: string; contractId: string; changed: boolean }> {
    const contract = await this.loadAccessibleContract(dto.contractId, actor);
    if (contract.status === 'CANCELLED') {
      throw new UnprocessableEntityException({ code: 'CONTRACT_CANCELLED', message: 'A cancelled contract cannot be linked to an Operations project.' });
    }

    // The contract's factory comes ONLY from the explicit plant mapping. An unset plant (or an unmapped one) is never
    // guessed or assigned here: it just means the link has no automatic basis and must carry a reason.
    const contractFactory = await this.factoryOfPlant(contract.plantId);

    try {
      return await this.db.getClient().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM operations_source_projects WHERE id = ${projectId}::uuid FOR UPDATE`;
        const project = await tx.operationsSourceProject.findUnique({ where: { id: projectId } });
        if (!project) throw new NotFoundException({ code: 'SOURCE_PROJECT_NOT_FOUND', message: 'Operations project not found' });

        // Automatic matching needs a confirmed job order AND a mapped factory that agree. A person may still link
        // explicitly without that basis (same permission, scope, eligibility and one-to-one rules) — but must say why.
        const automaticBasis =
          project.jobOrderNormalized !== null &&
          normalizeJobOrder(contract.jobOrder) === project.jobOrderNormalized &&
          project.factoryCode !== null &&
          contractFactory !== null &&
          contractFactory === project.factoryCode;

        if (project.excludedReason) {
          throw new UnprocessableEntityException({
            code: 'PROJECT_EXCLUDED',
            message: 'This Operations project is marked as training or test by the source and cannot be linked to a contract.',
          });
        }
        if (project.contractId === dto.contractId) return { id: project.id, contractId: dto.contractId, changed: false };

        const occupant = await tx.operationsSourceProject.findUnique({ where: { contractId: dto.contractId }, select: { id: true, sourceProjectId: true } });
        if (occupant && occupant.id !== project.id) {
          throw new ConflictException({
            code: 'CONTRACT_ALREADY_LINKED',
            message: `This contract is already linked to Operations project ${occupant.sourceProjectId}. Remove that link first.`,
          });
        }

        const previousContractId = project.contractId;
        if (previousContractId !== null && !dto.reason) {
          throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'A reason is required to change an existing link.' });
        }
        if (!automaticBasis && !dto.reason) {
          throw new BadRequestException({
            code: 'REASON_REQUIRED',
            message:
              'This contract cannot be matched to the project automatically (job order or mapped factory could not be confirmed). Give a reason to link it by hand; the plant is not changed.',
          });
        }

        const now = this.now();
        await tx.operationsSourceProject.update({
          where: { id: project.id },
          data: { contractId: dto.contractId, linkMethod: 'MANUAL', linkedAt: now, linkedByUserId: actor.id, linkedByName: actor.displayName },
        });
        await tx.operationsProjectLinkEvent.create({
          data: {
            projectId: project.id,
            action: previousContractId ? 'RELINKED' : 'LINKED',
            previousContractId,
            newContractId: dto.contractId,
            actorUserId: actor.id,
            actorName: actor.displayName,
            reason: dto.reason ?? null,
            details: { sourceProjectId: project.sourceProjectId, contractReference: contract.referenceNumber, automaticBasis, plantSet: contract.plantId !== null, mappedFactory: contractFactory } as never,
          },
        });
        await tx.contractActivity.create({
          data: {
            contractId: dto.contractId,
            actorUserId: actor.id,
            actorName: actor.displayName,
            event: 'operations_project_linked',
            metadata: { sourceProjectId: project.sourceProjectId, reason: dto.reason ?? null, automaticBasis } as never,
          },
        });
        if (previousContractId) {
          await tx.contractActivity.create({
            data: {
              contractId: previousContractId,
              actorUserId: actor.id,
              actorName: actor.displayName,
              event: 'operations_project_unlinked',
              metadata: { sourceProjectId: project.sourceProjectId, reason: dto.reason ?? null, replacedBy: dto.contractId } as never,
            },
          });
        }
        return { id: project.id, contractId: dto.contractId, changed: true };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({ code: 'CONTRACT_ALREADY_LINKED', message: 'This contract is already linked to another Operations project.' });
      }
      throw err;
    }
  }

  async unlinkProject(actor: AuthUser, projectId: string, dto: UnlinkSourceProjectDto): Promise<{ id: string }> {
    const existing = await this.db.getClient().operationsSourceProject.findUnique({ where: { id: projectId }, select: { contractId: true } });
    if (!existing) throw new NotFoundException({ code: 'SOURCE_PROJECT_NOT_FOUND', message: 'Operations project not found' });
    if (existing.contractId !== null) await this.loadAccessibleContract(existing.contractId, actor);

    await this.db.getClient().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM operations_source_projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const project = await tx.operationsSourceProject.findUnique({ where: { id: projectId } });
      if (!project || project.contractId === null) {
        throw new UnprocessableEntityException({ code: 'NOT_LINKED', message: 'This Operations project is not linked to a contract.' });
      }
      const previousContractId = project.contractId;
      await tx.operationsSourceProject.update({
        where: { id: projectId },
        data: { contractId: null, linkMethod: null, linkedAt: null, linkedByUserId: null, linkedByName: null },
      });
      await tx.operationsProjectLinkEvent.create({
        data: {
          projectId,
          action: 'UNLINKED',
          previousContractId,
          newContractId: null,
          actorUserId: actor.id,
          actorName: actor.displayName,
          reason: dto.reason,
          details: { sourceProjectId: project.sourceProjectId } as never,
        },
      });
      await tx.contractActivity.create({
        data: {
          contractId: previousContractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'operations_project_unlinked',
          metadata: { sourceProjectId: project.sourceProjectId, reason: dto.reason } as never,
        },
      });
    });
    return { id: projectId };
  }

  // ---------------------------------------------------------------------------
  // Factory mapping
  // ---------------------------------------------------------------------------

  async setFactoryMapping(actor: AuthUser, dto: SetFactoryMappingDto): Promise<{ id: string }> {
    const db = this.db.getClient();
    const factoryCode = normalizeFactoryCode(dto.factoryCode);
    if (factoryCode === null) throw new BadRequestException({ code: 'FACTORY_CODE_REQUIRED', message: 'Factory code is required' });
    const plant = await db.plant.findUnique({ where: { id: dto.plantId }, select: { id: true, isActive: true } });
    if (!plant || !plant.isActive) throw new NotFoundException({ code: 'PLANT_NOT_FOUND', message: 'Plant not found or inactive' });
    try {
      return await db.$transaction(async (tx) => {
        const row = await tx.operationsFactoryMapping.upsert({
          where: { factoryCode },
          create: { factoryCode, plantId: dto.plantId, createdByUserId: actor.id },
          update: { plantId: dto.plantId, createdByUserId: actor.id },
          select: { id: true },
        });
        await tx.securityAuditEvent.create({
          data: { event: 'operations_factory_mapping_set', actorId: actor.id, metadata: { factoryCode, plantId: dto.plantId } as never },
        });
        return row;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({ code: 'PLANT_ALREADY_MAPPED', message: 'That plant is already mapped to another factory code.' });
      }
      throw err;
    }
  }

  async deleteFactoryMapping(actor: AuthUser, id: string): Promise<{ id: string }> {
    const db = this.db.getClient();
    const row = await db.operationsFactoryMapping.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'MAPPING_NOT_FOUND', message: 'Factory mapping not found' });
    await db.$transaction(async (tx) => {
      await tx.operationsFactoryMapping.delete({ where: { id } });
      await tx.securityAuditEvent.create({
        data: { event: 'operations_factory_mapping_removed', actorId: actor.id, metadata: { factoryCode: row.factoryCode, plantId: row.plantId } as never },
      });
    });
    return { id };
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  private async loadAccessibleContract(contractId: string, actor: AuthUser) {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, referenceNumber: true, title: true, jobOrder: true, plantId: true, departmentId: true, status: true },
    });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
    return contract;
  }

  private async factoryOfPlant(plantId: string | null): Promise<string | null> {
    if (plantId === null) return null;
    const m = await this.db.getClient().operationsFactoryMapping.findUnique({ where: { plantId }, select: { factoryCode: true } });
    return m?.factoryCode ?? null;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

