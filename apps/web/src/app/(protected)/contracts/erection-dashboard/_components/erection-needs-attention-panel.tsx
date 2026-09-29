import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ErectionWorkQueueRow } from '@/lib/contracts-api';
import {
  ERECTION_ATTENTION_LABELS,
  ERECTION_ATTENTION_BADGE_CLASSES,
  ERECTION_PRIMARY_ACTION_BUTTON_CLASS,
  ERECTION_SECONDARY_ACTION_BUTTON_CLASS,
} from '../../_lib/contract-erection-dashboard-helpers';

interface Props {
  rows: ErectionWorkQueueRow[];
  /** null shows every row (the "full" view); a number caps the list to that many, with a "View all" link when there are more. */
  limit: number | null;
  /** Where the "View all attention items" link points when `limit` truncates the list. */
  viewAllHref: string;
}

/**
 * FMP-UI-19 — "only important items that need action": rows already
 * filtered by the caller via selectErectionNeedsAttention() (attention !==
 * ON_TRACK). Each item shows exactly what the brief asked for — project
 * name, contract number, current step, a reason (the same real `attention`
 * label the Status column uses elsewhere, never a fabricated sentence), and
 * one action button. A viewer who can act gets "Open Workflow" straight to
 * nextAction.href; a strictly read-only viewer gets "View Contract" instead,
 * so the button is never a dead end.
 *
 * FMP-UI-19D — lives in a half-width column (this dashboard's 2-column
 * layout), one stacked column. Caps to the top 3 items by default with a
 * "View all attention items" link when there are more.
 *
 * FMP-UI-19E — 2 polish changes per direct feedback:
 * (1) "Reason" is now the same colored pill (`ERECTION_ATTENTION_BADGE_CLASSES`)
 * the Status column already uses elsewhere, not plain text after a colon —
 * one glance tells you WHY without reading a sentence.
 * (2) The action is now a real solid button (`ERECTION_PRIMARY_ACTION_BUTTON_CLASS`)
 * instead of a red text link that could be mistaken for a plain hyperlink —
 * "should look like a real button, not only a red text link," this unit's
 * own words.
 */
export function ErectionNeedsAttentionPanel({ rows, limit, viewAllHref }: Props): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-center shadow-sm">
        <p className="text-sm text-text-secondary">No erection items need attention.</p>
      </div>
    );
  }

  const visible = limit !== null ? rows.slice(0, limit) : rows;
  const hasMore = limit !== null && rows.length > limit;

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {visible.map((r) => (
          <li key={r.contractId} className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
            <p className="text-sm font-semibold text-text-primary truncate" title={r.projectName}>{r.projectName}</p>
            <Link href={`/contracts/${r.contractId}`} className="font-mono text-xs text-accent hover:underline">{r.contractReference}</Link>
            <p className="mt-2 text-xs text-text-secondary">
              <span className="font-medium text-text-primary">Current step:</span> {r.currentErectionStep}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="font-medium text-text-primary">Reason:</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_ATTENTION_BADGE_CLASSES[r.attention]}`}>
                {ERECTION_ATTENTION_LABELS[r.attention]}
              </span>
            </div>
            <div className="mt-3">
              {r.viewerActionMode === 'READ_ONLY' ? (
                <Link href={`/contracts/${r.contractId}`} className={ERECTION_SECONDARY_ACTION_BUTTON_CLASS}>
                  View Contract
                  <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                </Link>
              ) : (
                <Link href={r.nextAction.href} className={ERECTION_PRIMARY_ACTION_BUTTON_CLASS}>
                  Open Workflow
                  <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Link href={viewAllHref} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          View all attention items ({rows.length})
          <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
