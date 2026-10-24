import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { diffTotals, evaluateFlags, OPERATIONS_REPORT_COLUMNS, OPERATIONS_REPORT_GROUP_BY, type OperationsTotals, type ParsedProgressReport } from '@recafco/shared';
import { DatabaseService } from '../../database/database.service';
import type { AuthUser } from '../../common/types/auth-user';
import { DEMO_PROJECT_ID_PREFIX, operationsDemoAllowed } from '../demo-guard';

// ---------------------------------------------------------------------------
// FMP-OPS-02 — DEVELOPMENT-ONLY demonstration of the Operations monitoring screens, because no real integration
// credentials exist yet. It writes ONLY to its own isolated demonstration contract/project (identified by the fixed
// reference number and the `demo-` source id) and never touches real contract values, BOQ or history.
// Every method refuses to run unless operationsDemoAllowed() (not production AND explicitly enabled).
// ---------------------------------------------------------------------------

export const DEMO_CONTRACT_REFERENCE = 'CONTRACT-2026-970001';
export const DEMO_SOURCE_PROJECT_ID = `${DEMO_PROJECT_ID_PREFIX}shapoorji-2025-92`;
const DEMO_TITLE = '[DEMO] New Al Sabah Hospital — Operations monitoring demonstration';

/** Starting figures: the documented 92/25 excerpt, so the demonstration looks like the real project. */
const BASELINE: OperationsTotals = { total: 2727, issued: 2727, produced: 2219, delivered: 1610, installed: 1482, pendingInputs: 1966 };

export type DemoAction = 'update' | 'outage' | 'recovery';

/**
 * Demonstration-only richer figures, derived from the demonstration totals so the screens can show balances, stock,
 * source percentages, quantities with missing counts and a separate history. Invented fixture numbers — never real data.
 */
export function demoMeasures(t: OperationsTotals): Record<string, number> {
  const pct = (n: number): number => (t.total > 0 ? n / t.total : 0);
  return {
    balance_produce: t.total - t.produced,
    balance_deliver: t.total - t.delivered,
    stock: t.produced - t.delivered,
    scheduled: 0,
    issued_pct: pct(t.issued),
    produced_pct: pct(t.produced),
    balance_produce_pct: pct(t.total - t.produced),
    delivered_pct: pct(t.delivered),
    balance_deliver_pct: pct(t.total - t.delivered),
    installed_pct: pct(t.installed),
    total_volume: 5384.408,
    missing_total_volume: 204,
    produced_volume: Math.round(t.produced * 2.127 * 1000) / 1000,
    missing_produced_volume: 3,
    delivered_volume: Math.round(t.delivered * 2.202 * 1000) / 1000,
    installed_volume: Math.round(t.installed * 2.225 * 1000) / 1000,
    total_area: 7988.982,
    missing_total_area: 1751,
    total_length: 6763.68,
    missing_total_length: 1751,
    cast_volume: Math.round(t.produced * 2.127 * 1000) / 1000,
    missing_cast_volume: 3,
    missing_concrete: 2727,
  };
}

/** History deliberately differs from the current cast volume, like the real report: both are shown, never reconciled. */
export function demoHistorical(t: OperationsTotals): Record<string, number> {
  return { produced: t.produced, delivered: t.delivered, installed: t.installed, factory_stock: t.produced - t.delivered, cast_volume: Math.round(t.produced * 2.112 * 1000) / 1000, unallocated_produced: 0, held: 0, surplus: 0, rejected: 0 };
}

export interface DemoStatus {
  enabled: true;
  contractId: string | null;
  sourceProjectId: string;
  contractReference: string;
  hasSnapshot: boolean;
  lastOutcome: string | null;
  totals: OperationsTotals | null;
}

/** Pure: the next figures for a simulated progress update. Cumulative counts only grow and keep their documented overlap. */
export function nextDemoTotals(t: OperationsTotals): OperationsTotals {
  const produced = Math.min(t.issued, t.produced + 40);
  const delivered = Math.min(produced, t.delivered + 25);
  const installed = Math.min(delivered, t.installed + 15);
  const pendingInputs = Math.max(0, t.pendingInputs - 20);
  return { ...t, produced, delivered, installed, pendingInputs };
}

function hashOf(totals: OperationsTotals, name: string, report: ParsedProgressReport): string {
  return createHash('sha256').update(JSON.stringify({ demo: true, name, totals, measures: report.measures })).digest('hex');
}

@Injectable()
export class OperationsDemoService {
  constructor(private readonly db: DatabaseService) {}

  private assertAllowed(): void {
    // 404, not 403: in production this feature simply does not exist.
    if (!operationsDemoAllowed()) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
  }

  async status(): Promise<DemoStatus> {
    this.assertAllowed();
    const db = this.db.getClient();
    const contract = await db.contract.findUnique({ where: { referenceNumber: DEMO_CONTRACT_REFERENCE }, select: { id: true } });
    const project = await db.operationsSourceProject.findUnique({ where: { sourceProjectId: DEMO_SOURCE_PROJECT_ID } });
    const snap = project?.currentSnapshotId ? await db.operationsProgressSnapshot.findUnique({ where: { id: project.currentSnapshotId } }) : null;
    return {
      enabled: true,
      contractId: contract?.id ?? null,
      sourceProjectId: DEMO_SOURCE_PROJECT_ID,
      contractReference: DEMO_CONTRACT_REFERENCE,
      hasSnapshot: snap !== null,
      lastOutcome: project?.lastOutcome ?? null,
      totals: snap ? { total: snap.total, issued: snap.issued, produced: snap.produced, delivered: snap.delivered, installed: snap.installed, pendingInputs: snap.pendingInputs } : null,
    };
  }

  /** Creates the isolated demonstration contract + project + first fixture snapshot. Idempotent. */
  async seed(actor: AuthUser): Promise<DemoStatus> {
    this.assertAllowed();
    const db = this.db.getClient();
    await db.$transaction(async (tx) => {
      let contract = await tx.contract.findUnique({ where: { referenceNumber: DEMO_CONTRACT_REFERENCE }, select: { id: true } });
      if (!contract) {
        contract = await tx.contract.create({
          data: {
            referenceNumber: DEMO_CONTRACT_REFERENCE,
            title: DEMO_TITLE,
            counterpartyName: 'Demonstration only',
            jobOrder: 'DEMO-92/25',
            status: 'ACTIVE',
            ownerUserId: actor.id,
            createdByUserId: actor.id,
            // Like any contract, it belongs to its creator's department, so department scoping applies to it as usual.
            departmentId: actor.departmentId,
            description: 'Isolated demonstration contract for the Operations monitoring screens. Not a real contract.',
          },
          select: { id: true },
        });
      }
      let project = await tx.operationsSourceProject.findUnique({ where: { sourceProjectId: DEMO_SOURCE_PROJECT_ID } });
      if (!project) {
        project = await tx.operationsSourceProject.create({
          data: {
            sourceProjectId: DEMO_SOURCE_PROJECT_ID,
            sourceCode: 'DEMO-92/25',
            jobOrderNormalized: 'DEMO/92/25',
            factoryCode: 'PC',
            sourceName: 'DEMONSTRATION — New Al Sabah Hospital',
            identityVerifiedAt: new Date(),
            contractId: contract.id,
            linkMethod: 'MANUAL',
            linkedAt: new Date(),
            linkedByUserId: actor.id,
            linkedByName: 'Demonstration setup',
            // The worker never synchronises demonstration projects (also excluded in its claim query).
            syncEnabled: false,
          },
        });
        await tx.operationsProjectLinkEvent.create({
          data: { projectId: project.id, action: 'LINKED', newContractId: contract.id, actorUserId: actor.id, actorName: actor.displayName, reason: 'Demonstration setup', details: { demonstration: true } as never },
        });
      }
      if (!project.currentSnapshotId) await this.publish(tx as never, project.id, BASELINE, null);
    });
    return this.status();
  }

  /** Removes the demonstration's own snapshots/runs and starts again from the baseline figures. */
  async reset(actor: AuthUser): Promise<DemoStatus> {
    this.assertAllowed();
    await this.seed(actor);
    const db = this.db.getClient();
    const project = await db.operationsSourceProject.findUniqueOrThrow({ where: { sourceProjectId: DEMO_SOURCE_PROJECT_ID } });
    await db.$transaction(async (tx) => {
      await tx.operationsSourceProject.update({ where: { id: project.id }, data: { currentSnapshotId: null, lastSuccessAt: null, lastAttemptAt: null, lastGeneratedAt: null, lastOutcome: null, lastErrorMessage: null, consecutiveFailures: 0 } });
      await tx.operationsSyncRun.deleteMany({ where: { projectId: project.id } });
      await tx.operationsProgressSnapshot.deleteMany({ where: { projectId: project.id } });
      await this.publish(tx as never, project.id, BASELINE, null);
    });
    return this.status();
  }

  async simulate(actor: AuthUser, action: DemoAction): Promise<DemoStatus> {
    this.assertAllowed();
    await this.seed(actor);
    const db = this.db.getClient();
    const project = await db.operationsSourceProject.findUniqueOrThrow({ where: { sourceProjectId: DEMO_SOURCE_PROJECT_ID } });
    const current = project.currentSnapshotId ? await db.operationsProgressSnapshot.findUnique({ where: { id: project.currentSnapshotId } }) : null;
    const totals: OperationsTotals = current
      ? { total: current.total, issued: current.issued, produced: current.produced, delivered: current.delivered, installed: current.installed, pendingInputs: current.pendingInputs }
      : BASELINE;

    await db.$transaction(async (tx) => {
      if (action === 'outage') {
        const now = new Date();
        await tx.operationsSyncRun.create({ data: { projectId: project.id, trigger: 'DEMO', startedAt: now, finishedAt: now, outcome: 'NETWORK_ERROR', message: 'Simulated source outage (demonstration).' } });
        // Failure bookkeeping only: figures, snapshot and last-success time are left exactly as they were.
        await tx.operationsSourceProject.update({
          where: { id: project.id },
          data: { lastAttemptAt: now, lastOutcome: 'NETWORK_ERROR', lastErrorMessage: 'Simulated source outage (demonstration).', consecutiveFailures: project.consecutiveFailures + 1 },
        });
        return;
      }
      // 'update' and 'recovery' both accept a newer response; recovery also clears the failure state.
      await this.publish(tx as never, project.id, nextDemoTotals(totals), current?.id ?? null, action);
    });
    return this.status();
  }

  private async publish(
    tx: ReturnType<DatabaseService['getClient']>,
    projectId: string,
    totals: OperationsTotals,
    previousSnapshotId: string | null,
    action: DemoAction | 'baseline' = 'baseline',
  ): Promise<void> {
    const now = new Date();
    const name = 'DEMONSTRATION — New Al Sabah Hospital';
    const previous = previousSnapshotId ? await tx.operationsProgressSnapshot.findUnique({ where: { id: previousSnapshotId } }) : null;
    const prevTotals: OperationsTotals | null = previous
      ? { total: previous.total, issued: previous.issued, produced: previous.produced, delivered: previous.delivered, installed: previous.installed, pendingInputs: previous.pendingInputs }
      : null;
    const report: ParsedProgressReport = {
      sourceProjectId: DEMO_SOURCE_PROJECT_ID, code: 'DEMO-92/25', factory: 'PC', name, totals, generatedAt: now,
      reviewRequiredFlag: null, reviewRequiredRaw: null, sourceNotes: [], unrecognisedKeys: [], historicalPresent: true, shapeWarnings: [],
      measures: demoMeasures(totals), historical: demoHistorical(totals), breakdown: { groupField: 'building', rows: [{ label: 'Main building / area', values: { ...demoMeasures(totals), total: totals.total, issued: totals.issued, produced: totals.produced, delivered: totals.delivered, installed: totals.installed, pending_inputs: totals.pendingInputs } }], truncated: false },
      reviewNotes: [], conflictMarks: { count: 0, raw: [] },
    };
    const snapshot = await tx.operationsProgressSnapshot.create({
      data: {
        projectId, origin: 'FIXTURE', retrievedAt: now, generatedAt: now, sourceCode: 'DEMO-92/25', sourceFactory: 'PC', sourceName: name,
        ...totals, groupBy: OPERATIONS_REPORT_GROUP_BY, columns: OPERATIONS_REPORT_COLUMNS, contentHash: hashOf(totals, name, report),
        measures: report.measures as never, historical: report.historical as never, breakdown: report.breakdown as never,
        previousSnapshotId, changes: diffTotals(prevTotals, totals) as never,
        flags: evaluateFlags(prevTotals ? { totals: prevTotals, code: 'DEMO-92/25', factory: 'PC' } : null, report) as never,
      },
    });
    await tx.operationsSyncRun.create({ data: { projectId, trigger: 'DEMO', startedAt: now, finishedAt: now, outcome: 'ACCEPTED', message: action === 'baseline' ? 'Demonstration baseline.' : `Simulated ${action}.` } });
    await tx.operationsSourceProject.update({
      where: { id: projectId },
      data: { currentSnapshotId: snapshot.id, lastGeneratedAt: now, lastSuccessAt: now, lastAttemptAt: now, lastOutcome: 'ACCEPTED', lastErrorMessage: null, consecutiveFailures: 0 },
    });
  }
}
