'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import type { BlockingItem } from '../../../../_lib/contract-closeout-detail-helpers';
import { sortBlockingItemsByPriority, humanizeStatus, blockingStatusTone } from '../../../../_lib/contract-closeout-detail-helpers';

interface Props {
  items: BlockingItem[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PRIORITY_CLASSES: Record<string, string> = {
  LOW: 'bg-surface-secondary text-text-secondary',
  MEDIUM: 'bg-info-light text-info',
  HIGH: 'bg-warning-light text-warning',
  CRITICAL: 'bg-error-light text-error',
};

function PriorityChip({ value }: { value: string }): React.JSX.Element {
  if (value === '—') return <span className="text-text-muted">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${PRIORITY_CLASSES[value] ?? 'bg-surface-secondary text-text-secondary'}`}>
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}

// CM-67D — readable status badge: real stored value, humanized text, and a
// color bucketed only by the word's own meaning (see blockingStatusTone()).
const STATUS_TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-surface-secondary text-text-secondary',
  warning: 'bg-warning-light text-warning',
  error: 'bg-error-light text-error',
};

function StatusBadge({ value }: { value: string }): React.JSX.Element {
  const tone = blockingStatusTone(value);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_TONE_CLASSES[tone]}`}>
      {humanizeStatus(value)}
    </span>
  );
}

const TABLE_COLUMNS = ['Source', 'Item', 'Priority', 'Action Required', 'Due Date', 'Status', 'Action'];

// CM-67B — compact by default: only the top VISIBLE_LIMIT highest-priority
// real blockers show; the rest are one click away via "View all", never
// hidden behind a fake/rounded count.
// CM-67C — dropped 6 to 5 for a slightly shorter default card height.
const VISIBLE_LIMIT = 5;

/**
 * CM-67 — Blocking Items: one real row per actual open workflow task,
 * outstanding payment, open claim, unresolved risk, open issue, pending/
 * expired document, or missing closeout approval — see
 * computeBlockingItems() for the exact real status sets used. No fake
 * blockers, no aggregated/summary rows.
 * CM-67B — capped to the top real highest-priority items by default (real
 * sort, never a fabricated ranking) so the card stays compact side-by-side
 * with the checklist; "View all N blocking items" expands the full real
 * list in place — no fake link, no invented aggregate page.
 * CM-67C — "View all" uses text-info (calm blue, the app's real link color)
 * instead of text-accent — accent is this theme's brand red, reserved for
 * primary actions/genuinely urgent states (see CM-64C), not a plain
 * expand-in-place link.
 * CM-67D — readability pass: the Status column now shows the real value
 * through humanizeStatus() as a colored badge (was raw SNAKE_CASE plain
 * text) instead of unlabeled text; "Action Due Date" header shortened to
 * "Due Date" and the Action link gained a subtle fill so it reads more
 * clearly as a button. No status set, sort order, or cap count changed.
 */
export function ContractCloseoutBlockingPanel({ items }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortBlockingItemsByPriority(items);
  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_LIMIT);

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Blocking Items</h2>
        <p className="text-xs text-text-secondary mt-0.5">Must be resolved before closing.</p>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-light px-4 py-3 text-sm text-success">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          No blocking items — every real closeout check has cleared.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-180 divide-y divide-border text-xs">
              <thead className="border-b-2 border-border-strong">
                <tr className="bg-surface-secondary">
                  {TABLE_COLUMNS.map((col) => (
                    <th key={col} className="px-2 py-2 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {visible.map((item, index) => (
                  <tr key={`${item.source}-${index}`} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-2 py-1 whitespace-nowrap text-text-secondary">{item.source}</td>
                    <td className="px-2 py-1 max-w-36 truncate text-text-primary font-medium" title={item.item}>{item.item}</td>
                    <td className="px-2 py-1 whitespace-nowrap"><PriorityChip value={item.priority} /></td>
                    <td className="px-2 py-1 max-w-28 truncate text-text-secondary" title={item.actionRequired}>{item.actionRequired}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-text-secondary">{formatDate(item.actionDueDate)}</td>
                    <td className="px-2 py-1 whitespace-nowrap"><StatusBadge value={item.status} /></td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <Link
                        href={item.actionHref}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-1 font-medium text-text-primary hover:border-accent hover:bg-accent-light hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                        title={`Open ${item.source}`}
                      >
                        View
                        <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sorted.length > VISIBLE_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline focus:outline-none"
            >
              {expanded ? (
                <>Show less <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" /></>
              ) : (
                <>View all {sorted.length} blocking items <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" /></>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
