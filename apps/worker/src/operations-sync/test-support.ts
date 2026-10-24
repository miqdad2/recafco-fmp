import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OperationsTotals } from '@recafco/shared';
import { exclusionReasonFor, type SourceProjectListItem } from '@recafco/shared';
import { planPublication, type CurrentSnapshotState } from './publication';
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
} from './store';

// Test-only helpers. FIXTURE data is based on the documented excerpt; nothing here is live data.

export function loadFixture(): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'report-92-25.documented-excerpt.json'), 'utf8')) as Record<string, unknown>;
  delete raw['_fixture'];
  return raw;
}

export function reportBody(
  overrides: { totals?: Partial<Record<string, unknown>>; generated_at?: string; project?: Record<string, unknown>; extra?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const base = loadFixture();
  return {
    ...base,
    project: { ...(base['project'] as object), ...(overrides.project ?? {}) },
    totals: { ...(base['totals'] as object), ...(overrides.totals ?? {}) },
    generated_at: overrides.generated_at ?? (base['generated_at'] as string),
    ...(overrides.extra ?? {}),
  };
}

export function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

export const TEST_PASSWORD = 'p4ss-w0rd-SECRET';

export const NOW = new Date('2026-10-21T10:30:00.000Z');

interface StoredProject {
  claimed: ClaimedProject;
  lastGeneratedAt: Date | null;
  current: (CurrentSnapshotState & { generatedAt: Date }) | null;
  snapshots: { id: string; flags: string[]; changes: number }[];
}

/** In-memory store using the REAL publication planner, so ordering/duplicate/flag rules are exercised. */
export class FakeStore implements OperationsSyncStore {
  projects = new Map<string, StoredProject>();
  attempts: AttemptRecord[] = [];
  statuses: StatusPatch[] = [];
  autoLinkCalls: string[] = [];
  releasedLeases: string[] = [];
  autoLinkResult: AutoLinkResult = { kind: 'NOT_LINKED', reason: 'test' };
  private seq = 0;
  due: string[] = [];

  addProject(id: string, sourceProjectId: string, contractId: string | null = null): ClaimedProject {
    const claimed: ClaimedProject = { id, sourceProjectId, contractId, consecutiveFailures: 0, trigger: 'SCHEDULED' };
    this.projects.set(id, { claimed, lastGeneratedAt: null, current: null, snapshots: [] });
    this.due.push(id);
    return claimed;
  }

  async claimDue(_now: Date, limit: number): Promise<ClaimedProject[]> {
    const ids = this.due.splice(0, limit);
    return ids.map((id) => {
      const p = this.projects.get(id);
      if (!p) throw new Error('unknown');
      return { ...p.claimed };
    });
  }

  async publish(project: ClaimedProject, input: PublishInput): Promise<PublishResult> {
    const stored = this.projects.get(project.id);
    if (!stored) throw new Error('unknown');
    const plan = planPublication(
      { lastGeneratedAt: stored.lastGeneratedAt, current: stored.current },
      input.report,
      input.contentHash,
    );
    if (plan.kind === 'OLDER') return { kind: 'OLDER' };
    const newest =
      stored.lastGeneratedAt !== null && stored.lastGeneratedAt > input.report.generatedAt ? stored.lastGeneratedAt : input.report.generatedAt;
    stored.lastGeneratedAt = newest;
    if (plan.kind === 'DUPLICATE') return { kind: 'DUPLICATE' };
    const id = `snap-${(this.seq += 1)}`;
    const totals: OperationsTotals = { ...input.report.totals };
    stored.current = {
      id,
      contentHash: input.contentHash,
      totals,
      code: input.report.code,
      factory: input.report.factory,
      generatedAt: input.report.generatedAt,
    };
    stored.snapshots.push({ id, flags: plan.flags.map((f) => f.code), changes: plan.changes.length });
    return { kind: 'PUBLISHED', snapshotId: id, plan };
  }

  async recordAttempt(project: ClaimedProject, record: AttemptRecord): Promise<void> {
    this.attempts.push(record);
    const stored = this.projects.get(project.id);
    if (stored) stored.claimed.consecutiveFailures = record.consecutiveFailures;
  }

  async releaseLease(projectId: string): Promise<void> {
    this.releasedLeases.push(projectId);
  }

  async tryAutoLink(projectId: string): Promise<AutoLinkResult> {
    this.autoLinkCalls.push(projectId);
    return this.autoLinkResult;
  }

  async upsertStatus(patch: StatusPatch): Promise<void> {
    this.statuses.push(patch);
  }

  // --- discovery (in-memory model of the same rules the Prisma store implements) ---
  discoveryDue = true;
  discoveryClaims = 0;
  discoveryRecords: { outcome: string; message: string | null; projectCount: number | null; success: boolean }[] = [];
  autoLinkBatches: number[] = [];
  /** Source projects the fake "database" knows after discovery, keyed by source id. */
  known = new Map<string, { id: string; code: string | null; name: string | null; factory: string | null; excludedReason: string | null; contractId: string | null; missingSince: Date | null; listed: boolean }>();

  async claimDiscovery(): Promise<boolean> {
    if (!this.discoveryDue) return false;
    this.discoveryDue = false;
    this.discoveryClaims += 1;
    return true;
  }

  async applyDiscovery(projects: SourceProjectListItem[], now: Date, exclusions: ReadonlySet<string>): Promise<DiscoverySummary> {
    const previouslyListed = [...this.known.values()].filter((k) => k.listed).length;
    const summary: DiscoverySummary = { listed: projects.length, created: 0, updated: 0, excluded: {}, newlyEligible: 0, markedMissing: 0, shrankIgnored: false, skipped: 0 };
    const ids = new Set(projects.map((p) => p.id));
    for (const p of projects) {
      const reason = exclusionReasonFor(p, exclusions);
      if (reason) summary.excluded[reason] = (summary.excluded[reason] ?? 0) + 1;
      const prev = this.known.get(p.id);
      if (prev) summary.updated += 1; else { summary.created += 1; if (!reason) summary.newlyEligible += 1; }
      // A rename / re-code updates the identity columns ONLY: contractId (the confirmed link) is never touched.
      this.known.set(p.id, { id: p.id, code: p.code, name: p.name, factory: p.factory, excludedReason: reason, contractId: prev ? prev.contractId : null, missingSince: null, listed: true });
    }
    if (previouslyListed > 0 && projects.length < previouslyListed * 0.5) summary.shrankIgnored = true;
    else for (const k of this.known.values()) if (k.listed && !ids.has(k.id) && !k.missingSince) { k.missingSince = now; summary.markedMissing += 1; }
    return summary;
  }

  async autoLinkEligible(): Promise<AutoLinkBatchResult> {
    // Same rule the real store applies, reduced to what the tests need: unique (code, factory) among non-excluded projects.
    const eligible = [...this.known.values()].filter((k) => k.excludedReason === null && k.code && k.contractId === null);
    let linked = 0;
    for (const k of eligible) {
      const same = [...this.known.values()].filter((o) => o.excludedReason === null && o.code === k.code && o.factory === k.factory);
      if (same.length === 1 && this.contractsByCodeFactory.get(`${k.code}|${k.factory}`)?.length === 1) {
        k.contractId = this.contractsByCodeFactory.get(`${k.code}|${k.factory}`)![0]!;
        linked += 1;
      }
    }
    this.autoLinkBatches.push(linked);
    return { linked, notLinked: eligible.length - linked };
  }
  /** contract ids per "code|factory" for the fake matcher. */
  contractsByCodeFactory = new Map<string, string[]>();

  async recordDiscovery(r: { outcome: string; message: string | null; projectCount: number | null; success: boolean }): Promise<void> {
    this.discoveryRecords.push(r);
  }

  async pruneRuns(): Promise<number> {
    return 0;
  }
}
