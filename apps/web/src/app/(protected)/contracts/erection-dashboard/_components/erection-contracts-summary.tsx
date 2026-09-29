import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ErectionWorkQueueRow } from '@/lib/contracts-api';
import {
  ERECTION_ATTENTION_BADGE_CLASSES,
  ERECTION_ATTENTION_LABELS,
  ERECTION_PRIMARY_ACTION_BUTTON_CLASS,
  ERECTION_SECONDARY_ACTION_BUTTON_CLASS,
  erectionNextActionLabel,
} from '../../_lib/contract-erection-dashboard-helpers';
import { ErectionEmptyState } from './erection-empty-state';

interface Props {
  rows: ErectionWorkQueueRow[];
  /** null shows every row (the "full" view); a number caps the list to that many, with a "View all" link when there are more. */
  limit: number | null;
  /** Where the "View all erection workflow contracts" link points when `limit` truncates the list. */
  viewAllHref: string;
}

/**
 * FMP-UI-19D — replaces the wide 7-column `ErectionContractsTable` (deleted;
 * a `<table>` needing `overflow-x-auto`/`min-w-[960px]` — exactly the
 * "horizontal table scrolling" this unit's own brief calls out) with a
 * compact card/list layout: each contract is one `flex flex-wrap` row that
 * naturally reflows at any width instead of overflowing sideways. Caps to
 * the top 3 by default (`limit={3}` from the caller) with a "View all
 * erection workflow contracts" link when there are more; the full dashboard
 * route can pass `limit=null` to show every row in place instead.
 *
 * FMP-UI-19E — restructured into the 3 explicit zones the brief asked for
 * (left: Contract No./Project/Client — middle: Current Step/Status/Next
 * Action — right: Open Workflow/View Contract), and both actions are now
 * real buttons (`ERECTION_PRIMARY_ACTION_BUTTON_CLASS`/
 * `ERECTION_SECONDARY_ACTION_BUTTON_CLASS` — the same pair Needs Attention
 * uses) instead of plain text links, for one consistent, management-ready
 * button language across the whole dashboard.
 */
export function ErectionContractsSummary({ rows, limit, viewAllHref }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return <ErectionEmptyState />;
  }

  const visible = limit !== null ? rows.slice(0, limit) : rows;
  const hasMore = limit !== null && rows.length > limit;

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {visible.map((r) => (
          <li key={r.contractId} className="rounded-xl border border-border bg-surface p-3.5 shadow-sm flex flex-wrap items-center gap-4">
            {/* Left: identity */}
            <div className="min-w-40">
              <Link href={`/contracts/${r.contractId}`} className="font-mono text-sm font-semibold text-accent hover:underline">{r.contractReference}</Link>
              <p className="text-sm font-medium text-text-primary truncate max-w-48" title={r.projectName}>{r.projectName}</p>
              <p className="text-xs text-text-muted truncate max-w-48" title={r.client}>{r.client}</p>
            </div>

            {/* Middle: step / status / next action */}
            <div className="flex-1 min-w-52 space-y-1">
              <p className="text-xs text-text-secondary truncate" title={r.currentErectionStep}>
                <span className="font-medium text-text-primary">Step:</span> {r.currentErectionStep}
              </p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_ATTENTION_BADGE_CLASSES[r.attention]}`}>
                {ERECTION_ATTENTION_LABELS[r.attention]}
              </span>
              <p className="text-xs text-text-secondary truncate" title={erectionNextActionLabel(r)}>
                {erectionNextActionLabel(r)}
              </p>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 shrink-0">
              {r.viewerActionMode !== 'READ_ONLY' && (
                <Link href={r.nextAction.href} className={ERECTION_PRIMARY_ACTION_BUTTON_CLASS}>
                  Open Workflow
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                </Link>
              )}
              <Link href={`/contracts/${r.contractId}`} className={ERECTION_SECONDARY_ACTION_BUTTON_CLASS}>
                View Contract
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Link href={viewAllHref} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          View all erection workflow contracts ({rows.length})
          <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
