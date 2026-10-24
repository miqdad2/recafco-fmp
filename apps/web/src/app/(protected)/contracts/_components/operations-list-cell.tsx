import type { ProgressSummary } from '@/lib/operations-api';
import { STAGES, formatAge, formatCount, formatKuwaitDateTime } from '../_lib/operations-progress-helpers';
import { OperationsStatusBadge } from './operations-status-badge';

/** Short stage names for the narrow list cell. */
const SHORT: Record<string, string> = { technical: 'Issued', production: 'Produced', delivery: 'Delivered', erection: 'Erected' };

/**
 * FMP-OPS-02 — the Contract List "Project Progress" cell. Built from the same resolved summary as the Overview and
 * tabs. Unlinked contracts say "Not connected to Operations" (never zeros, never old local progress). Quantities are
 * plain counts of pieces — no badges such as Done/Not started and no percentages.
 */
export function OperationsListCell({ summary }: { summary: ProgressSummary | null }): React.JSX.Element {
  if (summary === null) return <span className="text-sm text-text-muted">Progress unavailable right now</span>;
  const { monitoringState: state, totals } = summary;

  if (state === 'NOT_LINKED') return <OperationsStatusBadge state={state} />;
  if (state === 'WAITING_FIRST_UPDATE' || totals === null) return <OperationsStatusBadge state="WAITING_FIRST_UPDATE" />;

  return (
    <div className="min-w-0 space-y-1.5" data-operations-list-state={state}>
      <OperationsStatusBadge state={state} />
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5 text-sm">
        {STAGES.map((s) => (
          <div key={s.key} className="contents">
            <dt className="text-xs text-text-secondary">{SHORT[s.key]}</dt>
            <dd className="font-semibold tabular-nums text-text-primary">
              {formatCount(totals[s.field])} <span className="text-xs font-normal text-text-muted">of {formatCount(totals.total)}</span>
            </dd>
          </div>
        ))}
      </dl>
      {summary.delayed && <p className="text-xs text-warning">Update delayed — showing the last accepted figures</p>}
      <p className="text-xs text-text-muted" data-retrieved-at={summary.lastSuccessfulRetrievalAt ?? ''}>
        Retrieved {formatKuwaitDateTime(summary.lastSuccessfulRetrievalAt)} ({formatAge(summary.lastSuccessfulRetrievalAt)})
      </p>
      {summary.retrievedVia === 'demo' && !summary.demonstration && (
        <p className="text-xs font-medium text-warning">Via the source&apos;s demo sign-in — depends on its demo access</p>
      )}
    </div>
  );
}
