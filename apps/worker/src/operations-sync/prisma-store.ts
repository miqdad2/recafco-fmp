import { Prisma, type PrismaClient } from '@recafco/database';
import {
  evaluateProjectMatches,
  exclusionReasonFor,
  normalizeFactoryCode,
  normalizeJobOrder,
  OPERATIONS_REPORT_COLUMNS,
  OPERATIONS_REPORT_GROUP_BY,
  type MatchContract,
  type SourceProjectListItem,
} from '@recafco/shared';
import { planPublication } from './publication';
import type {
  AttemptRecord,
  AutoLinkBatchResult,
  AutoLinkResult,
  DiscoverySummary,
  ClaimedProject,
  OperationsSyncStore,
  PublishInput,
  PublishResult,
  StatusPatch,
  SyncTrigger,
} from './store';

/** After this many consecutive failures a user's Refresh no longer bypasses the backoff. */
const REFRESH_BYPASS_MAX_FAILURES = 3;
const SYSTEM_ACTOR_NAME = 'System (automatic match)';

interface ClaimRow {
  id: string;
  source_project_id: string;
  contract_id: string | null;
  consecutive_failures: number;
  refresh_requested_at: Date | null;
  last_attempt_at: Date | null;
}

export class PrismaOperationsStore implements OperationsSyncStore {
  constructor(private readonly db: PrismaClient) {}

  async claimDue(now: Date, limit: number, owner: string, leaseMs: number): Promise<ClaimedProject[]> {
    const leaseUntil = new Date(now.getTime() + leaseMs);
    // FOR UPDATE SKIP LOCKED + lease: two workers (or two ticks) can never claim the same project.
    const rows = await this.db.$queryRaw<ClaimRow[]>(Prisma.sql`
      UPDATE operations_source_projects p
         SET lease_until = ${leaseUntil}, lease_owner = ${owner}
       WHERE p.id IN (
         SELECT id FROM operations_source_projects
          WHERE sync_enabled = true
            AND source_project_id NOT LIKE 'demo-%'
            AND excluded_reason IS NULL
            AND (contract_id IS NOT NULL OR identity_verified_at IS NULL)
            AND (lease_until IS NULL OR lease_until < ${now})
            AND (
              next_attempt_at IS NULL OR next_attempt_at <= ${now}
              OR (refresh_requested_at IS NOT NULL
                  AND (last_attempt_at IS NULL OR refresh_requested_at > last_attempt_at)
                  AND consecutive_failures < ${REFRESH_BYPASS_MAX_FAILURES})
            )
          ORDER BY COALESCE(next_attempt_at, to_timestamp(0)) ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
       )
      RETURNING p.id, p.source_project_id, p.contract_id, p.consecutive_failures, p.refresh_requested_at, p.last_attempt_at
    `);
    return rows.map((r) => {
      const refreshPending =
        r.refresh_requested_at !== null && (r.last_attempt_at === null || r.refresh_requested_at > r.last_attempt_at);
      const trigger: SyncTrigger = refreshPending ? 'REFRESH_REQUEST' : 'SCHEDULED';
      return {
        id: r.id,
        sourceProjectId: r.source_project_id,
        contractId: r.contract_id,
        consecutiveFailures: r.consecutive_failures,
        trigger,
      };
    });
  }

  async publish(project: ClaimedProject, input: PublishInput): Promise<PublishResult> {
    const { report, contentHash, retrievedAt } = input;
    return this.db.$transaction(
      async (tx): Promise<PublishResult> => {
        // Serialise with any other publisher / link change for this project.
        await tx.$queryRaw`SELECT id FROM operations_source_projects WHERE id = ${project.id}::uuid FOR UPDATE`;
        const row = await tx.operationsSourceProject.findUniqueOrThrow({ where: { id: project.id } });
        const current = row.currentSnapshotId
          ? await tx.operationsProgressSnapshot.findUnique({ where: { id: row.currentSnapshotId } })
          : null;

        const plan = planPublication(
          {
            lastGeneratedAt: row.lastGeneratedAt,
            current: current
              ? {
                  id: current.id,
                  contentHash: current.contentHash,
                  totals: {
                    total: current.total,
                    issued: current.issued,
                    produced: current.produced,
                    delivered: current.delivered,
                    installed: current.installed,
                    pendingInputs: current.pendingInputs,
                  },
                  code: current.sourceCode,
                  factory: current.sourceFactory,
                }
              : null,
          },
          report,
          contentHash,
        );

        if (plan.kind === 'OLDER') return { kind: 'OLDER' };

        const newestGenerated =
          row.lastGeneratedAt !== null && row.lastGeneratedAt > report.generatedAt ? row.lastGeneratedAt : report.generatedAt;
        // Identity as the source reports it: evidence for matching and display only. A rename never touches the link.
        const identity = {
          sourceCode: report.code,
          jobOrderNormalized: normalizeJobOrder(report.code),
          factoryCode: normalizeFactoryCode(report.factory),
          sourceName: report.name,
          identityVerifiedAt: report.code !== null ? retrievedAt : row.identityVerifiedAt,
        };

        if (plan.kind === 'DUPLICATE') {
          await tx.operationsSourceProject.update({
            where: { id: project.id },
            data: { lastGeneratedAt: newestGenerated, lastSuccessAt: retrievedAt, ...identity },
          });
          return { kind: 'DUPLICATE' };
        }

        const snapshot = await tx.operationsProgressSnapshot.create({
          data: {
            projectId: project.id,
            origin: 'LIVE',
            retrievedAt,
            generatedAt: report.generatedAt,
            sourceCode: report.code,
            sourceFactory: report.factory,
            sourceName: report.name,
            total: report.totals.total,
            issued: report.totals.issued,
            produced: report.totals.produced,
            delivered: report.totals.delivered,
            installed: report.totals.installed,
            pendingInputs: report.totals.pendingInputs,
            reviewRequiredFlag: report.reviewRequiredFlag,
            ...(report.reviewRequiredRaw !== null ? { reviewRequiredRaw: report.reviewRequiredRaw as never } : {}),
            sourceNotes: report.sourceNotes as never,
            groupBy: OPERATIONS_REPORT_GROUP_BY,
            columns: OPERATIONS_REPORT_COLUMNS,
            contentHash,
            previousSnapshotId: plan.previousSnapshotId,
            changes: plan.changes as never,
            flags: [
              ...plan.flags,
              ...report.shapeWarnings.map((message) => ({ code: 'SHAPE_WARNING', severity: 'info', message })),
            ] as never,
            httpStatus: input.httpStatus,
            durationMs: input.durationMs,
            responseBytes: input.bytes,
            unrecognisedKeys: report.unrecognisedKeys as never,
            historicalPresent: report.historicalPresent,
            ...(Object.keys(report.measures).length > 0 ? { measures: report.measures as never } : {}),
            ...(report.breakdown ? { breakdown: report.breakdown as never } : {}),
            ...(report.historical ? { historical: report.historical as never } : {}),
            authMode: input.authMode,
            reviewNotes: report.reviewNotes as never,
            ...(report.conflictMarks ? { conflictMarksCount: report.conflictMarks.count } : {}),
            ...(report.conflictMarks && report.conflictMarks.raw !== null ? { conflictMarksRaw: report.conflictMarks.raw as never } : {}),
          },
        });
        // Snapshot + pointer move in ONE transaction: readers see the old accepted snapshot or the new one, never a mix.
        await tx.operationsSourceProject.update({
          where: { id: project.id },
          data: { currentSnapshotId: snapshot.id, lastGeneratedAt: newestGenerated, lastSuccessAt: retrievedAt, ...identity },
        });
        return { kind: 'PUBLISHED', snapshotId: snapshot.id, plan };
      },
      { timeout: 15_000 },
    );
  }

  async recordAttempt(project: ClaimedProject, r: AttemptRecord): Promise<void> {
    const failed = r.outcome !== 'ACCEPTED' && r.outcome !== 'UNCHANGED' && r.outcome !== 'REJECTED_OLDER';
    await this.db.$transaction([
      this.db.operationsSyncRun.create({
        data: {
          projectId: project.id,
          trigger: r.trigger,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
          outcome: r.outcome,
          httpStatus: r.httpStatus,
          durationMs: r.durationMs,
          message: r.message,
        },
      }),
      this.db.operationsSourceProject.update({
        where: { id: project.id },
        data: {
          lastAttemptAt: r.startedAt,
          lastOutcome: r.outcome,
          ...(failed ? { lastErrorMessage: r.message } : r.outcome === 'REJECTED_OLDER' ? {} : { lastErrorMessage: null }),
          consecutiveFailures: r.consecutiveFailures,
          nextAttemptAt: r.nextAttemptAt,
          leaseUntil: null,
          leaseOwner: null,
        },
      }),
    ]);
  }

  async releaseLease(projectId: string, retryAt: Date): Promise<void> {
    await this.db.operationsSourceProject.update({
      where: { id: projectId },
      data: { leaseUntil: null, leaseOwner: null, nextAttemptAt: retryAt },
    });
  }

  // ---------------------------------------------------------------------------
  // Automatic linking (unique job order + factory, no conflict). Names never link.
  // ---------------------------------------------------------------------------

  private async loadMatchContext(): Promise<MatchContext> {
    const [contracts, mappings, eligible] = await Promise.all([
      this.db.contract.findMany({
        where: { jobOrder: { not: null }, status: { not: 'CANCELLED' } },
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          counterpartyName: true,
          jobOrder: true,
          status: true,
          plantId: true,
          operationsSourceProject: { select: { sourceProjectId: true } },
        },
      }),
      this.db.operationsFactoryMapping.findMany({ select: { factoryCode: true, plantId: true } }),
      // Identity counts over NON-excluded projects only: a training/test project must not create a false ambiguity.
      this.db.operationsSourceProject.findMany({
        where: { excludedReason: null, jobOrderNormalized: { not: null } },
        select: { jobOrderNormalized: true, factoryCode: true },
      }),
    ]);
    const factoryByPlant = new Map(mappings.map((m) => [m.plantId, m.factoryCode]));
    const matchContracts: MatchContract[] = contracts.map((c) => ({
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
    for (const p of eligible) {
      const key = `${p.jobOrderNormalized}|${p.factoryCode ?? ''}`;
      identityCount.set(key, (identityCount.get(key) ?? 0) + 1);
    }
    const contractJobOrders = new Set(matchContracts.map((c) => normalizeJobOrder(c.jobOrder)).filter((x): x is string => x !== null));
    return { matchContracts, identityCount, contractJobOrders };
  }

  private async linkIfUnique(
    project: {
      id: string;
      sourceProjectId: string;
      contractId: string | null;
      jobOrderNormalized: string | null;
      factoryCode: string | null;
      sourceName: string | null;
      excludedReason: string | null;
    },
    ctx: MatchContext,
    staggerWindowSeconds: number,
  ): Promise<AutoLinkResult> {
    if (project.contractId !== null) return { kind: 'NOT_LINKED', reason: 'already linked' };
    if (project.excludedReason !== null) return { kind: 'NOT_LINKED', reason: 'excluded from linking' };
    if (project.jobOrderNormalized === null) return { kind: 'NOT_LINKED', reason: 'job order not reported yet' };

    const others = (ctx.identityCount.get(`${project.jobOrderNormalized}|${project.factoryCode ?? ''}`) ?? 1) - 1;
    const evaluation = evaluateProjectMatches(
      {
        sourceProjectId: project.sourceProjectId,
        jobOrderNormalized: project.jobOrderNormalized,
        factoryCode: project.factoryCode,
        sourceName: project.sourceName,
        contractId: null,
      },
      ctx.matchContracts,
      others,
    );
    if (evaluation.state !== 'AUTO_LINKABLE' || evaluation.autoLinkContractId === null) {
      return { kind: 'NOT_LINKED', reason: evaluation.summary };
    }
    const contractId = evaluation.autoLinkContractId;
    const reasons = evaluation.candidates.find((c) => c.contractId === contractId)?.reasons ?? [];

    try {
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM operations_source_projects WHERE id = ${project.id}::uuid FOR UPDATE`;
        const fresh = await tx.operationsSourceProject.findUniqueOrThrow({ where: { id: project.id } });
        if (fresh.contractId !== null) throw new AutoLinkAbort('project was linked meanwhile');
        if (fresh.excludedReason !== null) throw new AutoLinkAbort('project is excluded');
        const now = new Date();
        // Spread first fetches of newly linked projects over the poll interval instead of all at once.
        const firstAttemptAt = staggerWindowSeconds > 0 ? new Date(now.getTime() + Math.random() * staggerWindowSeconds * 1000) : null;
        // The unique index on contract_id rejects a contract that was linked meanwhile (P2002).
        await tx.operationsSourceProject.update({
          where: { id: project.id },
          data: {
            contractId,
            linkMethod: 'AUTOMATIC',
            linkedAt: now,
            linkedByUserId: null,
            linkedByName: SYSTEM_ACTOR_NAME,
            ...(firstAttemptAt ? { nextAttemptAt: firstAttemptAt } : {}),
          },
        });
        await tx.operationsProjectLinkEvent.create({
          data: {
            projectId: project.id,
            action: 'AUTO_LINKED',
            previousContractId: null,
            newContractId: contractId,
            actorUserId: null,
            actorName: SYSTEM_ACTOR_NAME,
            reason: 'Unique match on job order and factory.',
            details: { reasons, sourceProjectId: project.sourceProjectId } as never,
          },
        });
        await tx.contractActivity.create({
          data: {
            contractId,
            actorUserId: null,
            actorName: SYSTEM_ACTOR_NAME,
            event: 'operations_project_auto_linked',
            metadata: { sourceProjectId: project.sourceProjectId, reasons } as never,
          },
        });
      });
    } catch (err) {
      if (err instanceof AutoLinkAbort) return { kind: 'NOT_LINKED', reason: err.message };
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { kind: 'NOT_LINKED', reason: 'contract was linked meanwhile' };
      }
      throw err;
    }
    // Keep the in-memory view consistent for the rest of this batch (the contract is now taken).
    const taken = ctx.matchContracts.find((c) => c.id === contractId);
    if (taken) taken.linkedSourceProjectId = project.sourceProjectId;
    return { kind: 'LINKED', contractId };
  }

  async tryAutoLink(projectId: string): Promise<AutoLinkResult> {
    const project = await this.db.operationsSourceProject.findUnique({
      where: { id: projectId },
      select: { id: true, sourceProjectId: true, contractId: true, jobOrderNormalized: true, factoryCode: true, sourceName: true, excludedReason: true },
    });
    if (!project) return { kind: 'NOT_LINKED', reason: 'unknown project' };
    return this.linkIfUnique(project, await this.loadMatchContext(), 0);
  }

  async autoLinkEligible(staggerWindowSeconds: number): Promise<AutoLinkBatchResult> {
    const ctx = await this.loadMatchContext();
    const candidates = await this.db.operationsSourceProject.findMany({
      where: { contractId: null, excludedReason: null, jobOrderNormalized: { not: null } },
      select: { id: true, sourceProjectId: true, contractId: true, jobOrderNormalized: true, factoryCode: true, sourceName: true, excludedReason: true },
    });
    let linked = 0;
    let notLinked = 0;
    for (const p of candidates) {
      // Cheap pre-filter: no contract carries this job order, so nothing can match.
      if (p.jobOrderNormalized === null || !ctx.contractJobOrders.has(p.jobOrderNormalized)) {
        notLinked += 1;
        continue;
      }
      const r = await this.linkIfUnique(p, ctx, staggerWindowSeconds);
      if (r.kind === 'LINKED') linked += 1;
      else notLinked += 1;
    }
    return { linked, notLinked };
  }

  // ---------------------------------------------------------------------------
  // Discovery from the source project list. Upserts by source id; NEVER deletes, unlinks or edits any contract.
  // ---------------------------------------------------------------------------

  async claimDiscovery(now: Date, intervalMs: number, owner: string, leaseMs: number): Promise<boolean> {
    // Make sure the singleton row exists, then claim atomically: due AND not leased by another run.
    await this.db.operationsSourceStatus.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });
    const leaseUntil = new Date(now.getTime() + leaseMs);
    const nextAt = new Date(now.getTime() + intervalMs);
    const rows = await this.db.$executeRaw`
      UPDATE operations_source_status
         SET discovery_lease_until = ${leaseUntil}, next_discovery_at = ${nextAt}
       WHERE id = 'default'
         AND (next_discovery_at IS NULL OR next_discovery_at <= ${now})
         AND (discovery_lease_until IS NULL OR discovery_lease_until < ${now})
    `;
    void owner;
    return rows > 0;
  }

  async applyDiscovery(projects: SourceProjectListItem[], now: Date, exclusions: ReadonlySet<string>): Promise<DiscoverySummary> {
    const existing = await this.db.operationsSourceProject.findMany({
      select: { id: true, sourceProjectId: true, lastListedAt: true, excludedReason: true, contractId: true },
    });
    const bySource = new Map(existing.map((e) => [e.sourceProjectId, e]));
    const listedIds = new Set(projects.map((p) => p.id));
    const previouslyListed = existing.filter((e) => e.lastListedAt !== null).length;

    const summary: DiscoverySummary = { listed: projects.length, created: 0, updated: 0, excluded: {}, newlyEligible: 0, markedMissing: 0, shrankIgnored: false, skipped: 0 };
    const ops: Prisma.PrismaPromise<unknown>[] = [];

    for (const p of projects) {
      const reason = exclusionReasonFor(p, exclusions);
      if (reason !== null) summary.excluded[reason] = (summary.excluded[reason] ?? 0) + 1;
      // Identity as the source reports it: evidence for matching and display only. A rename never touches a link.
      const identity = {
        sourceCode: p.code,
        jobOrderNormalized: normalizeJobOrder(p.code),
        factoryCode: normalizeFactoryCode(p.factory),
        sourceName: p.name,
        sourceIsTraining: p.isTraining,
        excludedReason: reason,
        ...(p.code !== null ? { identityVerifiedAt: now } : {}),
      };
      const known = bySource.get(p.id);
      if (!known) {
        summary.created += 1;
        if (reason === null) summary.newlyEligible += 1;
        ops.push(this.db.operationsSourceProject.create({ data: { sourceProjectId: p.id, ...identity, firstListedAt: now, lastListedAt: now } }));
      } else {
        summary.updated += 1;
        if (known.excludedReason !== null && reason === null) summary.newlyEligible += 1;
        ops.push(
          this.db.operationsSourceProject.update({
            where: { id: known.id },
            data: { ...identity, lastListedAt: now, missingFromListSince: null, ...(known.lastListedAt === null ? { firstListedAt: now } : {}) },
          }),
        );
      }
    }

    // A project missing from one response is only MARKED (never deleted/unlinked). A suspiciously small list is not trusted at all.
    const shrank = previouslyListed > 0 && projects.length < previouslyListed * 0.5;
    if (shrank) {
      summary.shrankIgnored = true;
    } else {
      for (const e of existing) {
        if (e.lastListedAt !== null && !listedIds.has(e.sourceProjectId)) {
          summary.markedMissing += 1;
          ops.push(this.db.operationsSourceProject.updateMany({ where: { id: e.id, missingFromListSince: null }, data: { missingFromListSince: now } }));
        }
      }
    }
    await this.db.$transaction(ops);
    return summary;
  }

  async recordDiscovery(r: { outcome: string; message: string | null; projectCount: number | null; success: boolean; nextAt: Date }): Promise<void> {
    await this.db.operationsSourceStatus.upsert({
      where: { id: 'default' },
      create: { id: 'default', lastDiscoveryAt: new Date(), lastDiscoveryOutcome: r.outcome, lastDiscoveryMessage: r.message, lastDiscoveryProjectCount: r.projectCount, nextDiscoveryAt: r.nextAt },
      update: {
        lastDiscoveryAt: new Date(),
        lastDiscoveryOutcome: r.outcome,
        lastDiscoveryMessage: r.message,
        ...(r.projectCount !== null ? { lastDiscoveryProjectCount: r.projectCount } : {}),
        nextDiscoveryAt: r.nextAt,
        discoveryLeaseUntil: null,
      },
    });
  }

  async upsertStatus(patch: StatusPatch): Promise<void> {
    const data = {
      connectionState: patch.connectionState,
      circuitOpenUntil: patch.circuitOpenUntil,
      consecutiveFailures: patch.consecutiveFailures,
      ...(patch.lastLoginAt !== undefined ? { lastLoginAt: patch.lastLoginAt } : {}),
      lastMessage: patch.lastMessage,
      workerHeartbeatAt: new Date(),
      pollIntervalSeconds: patch.pollIntervalSeconds,
      authMode: patch.authMode,
      discoveryEnabled: patch.discoveryEnabled,
    };
    await this.db.operationsSourceStatus.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });
  }

  async pruneRuns(olderThan: Date): Promise<number> {
    const res = await this.db.operationsSyncRun.deleteMany({ where: { startedAt: { lt: olderThan } } });
    return res.count;
  }
}

interface MatchContext {
  matchContracts: MatchContract[];
  identityCount: Map<string, number>;
  contractJobOrders: Set<string>;
}

class AutoLinkAbort extends Error {}
