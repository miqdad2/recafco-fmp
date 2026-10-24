import type { OperationsTotals, ParsedProgressReport, SourceProjectListItem } from '@recafco/shared';
import type { PublicationPlan } from './publication';

// ---------------------------------------------------------------------------
// FMP-OPS-01 — persistence boundary of the sync engine. The engine only talks
// to this interface; PrismaOperationsStore implements it, tests use a fake.
// ---------------------------------------------------------------------------

export type SyncOutcome =
  | 'ACCEPTED'
  | 'UNCHANGED'
  | 'REJECTED_OLDER'
  | 'REJECTED_INVALID'
  | 'AUTH_FAILED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'SOURCE_ERROR';

export type SyncTrigger = 'SCHEDULED' | 'REFRESH_REQUEST';

export type ConnectionState = 'NOT_CONFIGURED' | 'OK' | 'DEGRADED' | 'AUTH_FAILED' | 'PAUSED';

export interface ClaimedProject {
  id: string;
  sourceProjectId: string;
  contractId: string | null;
  consecutiveFailures: number;
  trigger: SyncTrigger;
}

export interface PublishInput {
  report: ParsedProgressReport;
  contentHash: string;
  retrievedAt: Date;
  httpStatus: number;
  durationMs: number;
  bytes: number;
  /** How this retrieval signed in. Stored with the snapshot as provenance. */
  authMode: 'password' | 'demo';
}

export type PublishResult =
  | { kind: 'PUBLISHED'; snapshotId: string; plan: Extract<PublicationPlan, { kind: 'PUBLISH' }> }
  | { kind: 'DUPLICATE' }
  | { kind: 'OLDER' };

export interface AttemptRecord {
  outcome: SyncOutcome;
  trigger: SyncTrigger;
  startedAt: Date;
  finishedAt: Date;
  httpStatus: number | null;
  durationMs: number | null;
  /** Sanitised, user-safe explanation; never contains credentials, cookies or URLs. */
  message: string | null;
  /** True when an accepted/unchanged retrieval happened (moves last_success_at). */
  retrieved: boolean;
  /** New value of the project's consecutive-failure counter. */
  consecutiveFailures: number;
  nextAttemptAt: Date;
}

export interface StatusPatch {
  connectionState: ConnectionState;
  circuitOpenUntil: Date | null;
  consecutiveFailures: number;
  lastLoginAt?: Date | null;
  lastMessage: string | null;
  pollIntervalSeconds: number;
  /** How the worker signs in ('password' | 'demo'). Shown to users: demo depends on the source's demo access. */
  authMode: 'password' | 'demo';
  discoveryEnabled: boolean;
}

export interface DiscoverySummary {
  listed: number;
  created: number;
  updated: number;
  /** Count per exclusion reason among the listed projects. */
  excluded: Record<string, number>;
  newlyEligible: number;
  /** Previously listed projects absent from this response: only MARKED, never deleted or unlinked. */
  markedMissing: number;
  /** The list was far smaller than before, so absences were not recorded. */
  shrankIgnored: boolean;
  /** Malformed list entries that were skipped. */
  skipped: number;
}

export interface AutoLinkBatchResult {
  linked: number;
  notLinked: number;
}

export type AutoLinkResult =
  | { kind: 'LINKED'; contractId: string }
  | { kind: 'NOT_LINKED'; reason: string };

export interface OperationsSyncStore {
  /** Atomically claims due projects (lease) so no project is synchronised by two runs at once. */
  claimDue(now: Date, limit: number, owner: string, leaseMs: number): Promise<ClaimedProject[]>;
  /** Locks the project row, re-decides against the authoritative state, and publishes atomically. */
  publish(project: ClaimedProject, input: PublishInput): Promise<PublishResult>;
  /** Writes the attempt log + project bookkeeping and releases the lease. */
  recordAttempt(project: ClaimedProject, record: AttemptRecord): Promise<void>;
  /** Releases the lease without recording an attempt (e.g. the circuit breaker was open). */
  releaseLease(projectId: string, retryAt: Date): Promise<void>;
  /** Automatic link, only when the shared matching rules find a unique, conflict-free match. */
  tryAutoLink(projectId: string): Promise<AutoLinkResult>;
  /** Links every unlinked, eligible project that has a unique, conflict-free job order + factory match. */
  autoLinkEligible(staggerWindowSeconds: number): Promise<AutoLinkBatchResult>;
  /** Atomically claims the (single) discovery slot if it is due and not leased. */
  claimDiscovery(now: Date, intervalMs: number, owner: string, leaseMs: number): Promise<boolean>;
  applyDiscovery(projects: SourceProjectListItem[], now: Date, exclusions: ReadonlySet<string>): Promise<DiscoverySummary>;
  recordDiscovery(result: { outcome: string; message: string | null; projectCount: number | null; success: boolean; nextAt: Date }): Promise<void>;
  upsertStatus(patch: StatusPatch): Promise<void>;
  pruneRuns(olderThan: Date): Promise<number>;
}

export type { OperationsTotals };
