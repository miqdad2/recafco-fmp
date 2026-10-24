import { createHash } from 'node:crypto';
import {
  canonicalContentOf,
  decidePublication,
  diffTotals,
  evaluateFlags,
  type FieldChange,
  type OperationsTotals,
  type ParsedProgressReport,
  type SnapshotFlag,
} from '@recafco/shared';

// ---------------------------------------------------------------------------
// FMP-OPS-01 — the pure part of "publish an accepted snapshot". The database
// store calls this INSIDE its row lock, so the decision is made against the
// authoritative current state (never a stale in-memory copy).
// ---------------------------------------------------------------------------

export interface CurrentSnapshotState {
  id: string;
  contentHash: string;
  totals: OperationsTotals;
  code: string | null;
  factory: string | null;
}

export interface PublicationState {
  /** Newest generated_at ever accepted for this project (advances even when content is unchanged). */
  lastGeneratedAt: Date | null;
  current: CurrentSnapshotState | null;
}

export type PublicationPlan =
  /** Generated before the newest accepted response: must not replace newer data. */
  | { kind: 'OLDER' }
  /** Same content as the current snapshot: only retrieval / generation time move. */
  | { kind: 'DUPLICATE' }
  | { kind: 'PUBLISH'; previousSnapshotId: string | null; changes: FieldChange[]; flags: SnapshotFlag[] };

export function hashContent(report: ParsedProgressReport): string {
  return createHash('sha256').update(canonicalContentOf(report)).digest('hex');
}

export function planPublication(state: PublicationState, report: ParsedProgressReport, contentHash: string): PublicationPlan {
  const decision = decidePublication(
    { latestGeneratedAt: state.lastGeneratedAt, contentHash: state.current?.contentHash ?? null },
    { generatedAt: report.generatedAt, contentHash },
  );
  if (decision === 'OLDER') return { kind: 'OLDER' };
  if (decision === 'DUPLICATE') return { kind: 'DUPLICATE' };
  return {
    kind: 'PUBLISH',
    previousSnapshotId: state.current?.id ?? null,
    changes: diffTotals(state.current?.totals ?? null, report.totals),
    flags: evaluateFlags(
      state.current ? { totals: state.current.totals, code: state.current.code, factory: state.current.factory } : null,
      report,
    ),
  };
}
