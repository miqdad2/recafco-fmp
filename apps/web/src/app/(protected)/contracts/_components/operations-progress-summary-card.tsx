import Link from 'next/link';
import type { ProgressView } from '@/lib/operations-api';
import {
  DEMO_BANNER,
  PENDING_INPUTS_LABEL,
  REQUIREMENT_LABEL,
  STAGES,
  delayedMessage,
  formatAge,
  formatCount,
  formatKuwaitDateTime,
} from '../_lib/operations-progress-helpers';
import { OperationsLiveRefresh } from './operations-live-refresh';
import { OperationsStatusBadge } from './operations-status-badge';

interface Props {
  contractId: string;
  /** null = FMP could not load it (the rest of the Overview is unaffected). */
  view: ProgressView | null;
}

/** Tab each stage links to. */
const STAGE_SEGMENT: Record<string, string> = {
  technical: 'technical',
  production: 'production-planning',
  delivery: 'delivery',
  erection: 'erection',
};

/**
 * FMP-OPS-02 — the Overview "Progress Summary". Reads the same resolved view as the Contract List and the four
 * department tabs. Counts only: the three overlapping counts are never added, nothing becomes a completion
 * percentage, and an unlinked contract says so instead of showing zeros.
 */
export function OperationsProgressSummaryCard({ contractId, view }: Props): React.JSX.Element {
  const data = view?.data ?? null;
  const state = view?.monitoringState ?? null;

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label="Progress Summary" data-progress-summary={state ?? 'unavailable'}>
      <OperationsLiveRefresh contractIds={[contractId]} everySeconds={state === 'DEMONSTRATION' ? 4 : 15} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Progress Summary</h2>
          <p className="text-sm text-text-secondary">From the Operations system (read-only). Open a stage for detail.</p>
        </div>
        {state && <OperationsStatusBadge state={state} className="self-start" />}
      </div>

      {state === 'DEMONSTRATION' && (
        <p role="status" className="mt-3 rounded-md border border-error bg-error-light px-3 py-2 text-sm font-semibold text-error">
          {DEMO_BANNER}
        </p>
      )}

      {view === null && <p className="mt-4 text-sm text-text-secondary">Operations progress could not be loaded right now. The rest of this contract is not affected.</p>}

      {state === 'NOT_LINKED' && (
        <p className="mt-4 text-base text-text-primary">
          <span className="font-semibold">Not connected to Operations.</span>{' '}
          <span className="text-text-secondary">No progress is shown until this contract is linked to its Operations project.</span>
        </p>
      )}

      {state === 'WAITING_FIRST_UPDATE' && <p className="mt-4 text-base text-text-secondary">Linked. The first update has not arrived yet; figures appear here automatically.</p>}

      {data && view && view.stale.stale && (
        <p role="status" className="mt-3 rounded-md border border-warning bg-warning-light px-3 py-2 text-sm text-warning">
          {delayedMessage(data.lastSuccessfulRetrievalAt, view.stale.reason)}
        </p>
      )}

      {data && (
        <>
          <div className="mt-4 rounded-md bg-surface-secondary px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">{REQUIREMENT_LABEL}</p>
            <p className="text-3xl font-semibold tabular-nums text-text-primary">
              {formatCount(data.totals.total)} <span className="text-base font-medium text-text-secondary">pieces</span>
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STAGES.map((s) => (
              <Link
                key={s.key}
                href={`/contracts/${contractId}/${STAGE_SEGMENT[s.key]}`}
                className="block rounded-lg border border-border bg-surface p-4 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <dt className="text-sm font-semibold text-text-primary">{s.title}</dt>
                <dd className="mt-2 text-xs font-medium text-text-secondary">{s.figureLabel}</dd>
                <dd className="text-3xl font-semibold tabular-nums text-text-primary" data-figure={s.field}>
                  {formatCount(data.totals[s.field])}
                </dd>
                <dd className="text-xs text-text-muted">pieces</dd>
              </Link>
            ))}
          </dl>
          <p className="mt-3 text-sm text-warning">
            {PENDING_INPUTS_LABEL}: <span className="font-semibold tabular-nums">{formatCount(data.totals.pendingInputs)}</span> pieces.
          </p>
          {data.retrievedVia === 'demo' && data.origin === 'LIVE' && (
            <p className="mt-2 rounded-md border border-warning bg-warning-light px-3 py-2 text-sm text-warning" data-demo-sign-in="true">
              Retrieved through the source&apos;s demo sign-in, not a dedicated integration account. These figures depend on the source keeping its demo access available.
            </p>
          )}
          <p className="mt-2 text-xs text-text-muted">
            Produced, delivered and erected counts are cumulative and overlap, so they are not added together. Last successful update{' '}
            {formatKuwaitDateTime(data.lastSuccessfulRetrievalAt)} ({formatAge(data.lastSuccessfulRetrievalAt)}).
          </p>
        </>
      )}
    </section>
  );
}
