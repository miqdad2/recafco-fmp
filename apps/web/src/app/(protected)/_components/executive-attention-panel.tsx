import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export interface AttentionCountItem {
  label: string;
  value: number;
  href?: string;
}

export interface AttentionRecordItem {
  id: string;
  label: string;
  description?: string;
  href: string;
}

interface Props {
  /** false when this module has no real "needs attention" data computed yet — the panel says so plainly instead of guessing. */
  available: boolean;
  note?: string | undefined;
  /** Real per-record attention rows (Contract Management's manager.attentionItems, Erection's overdueAttention) — used when the module has them. */
  recordItems?: AttentionRecordItem[] | undefined;
  /** Real aggregate counts (e.g. overdueTasks, criticalFindings) for modules with no per-record attention list — by default only entries with value > 0 are shown (an alert list); set `showZeroCounts` to render all of them instead (a fixed status row). */
  countItems?: AttentionCountItem[] | undefined;
  /** FMP-UI-07D — Contract Management wants all 4 named figures always visible, including zero ("if a value is zero, still show it clearly") rather than an alert list that disappears when nothing is wrong. Defaults to false so every other caller's existing "only show non-zero" behavior is unchanged. */
  showZeroCounts?: boolean;
  emptyMessage?: string;
}

/**
 * FMP-UI-07 — the Executive Module Landing Page's "Needs Attention" section.
 * Every branch renders real, already-computed data: either real per-record
 * rows (Contract Management, Erection) or real aggregate counts derived
 * straight from a module's own dashboard metrics (everything else). When a
 * module has neither, it says "Not available" honestly rather than
 * fabricating a list.
 */
export function ExecutiveAttentionPanel({
  available,
  note,
  recordItems,
  countItems,
  showZeroCounts = false,
  emptyMessage = 'Nothing currently needs attention in this module.',
}: Props): React.JSX.Element {
  if (!available) {
    return (
      <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
        {note ?? 'Not available for this module yet.'}
      </div>
    );
  }

  if (recordItems) {
    if (recordItems.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">{emptyMessage}</div>
      );
    }
    return (
      <ul className="space-y-2">
        {recordItems.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm transition hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                <span className="font-medium text-text-primary">{item.label}</span>
                {item.description && <span className="block text-text-muted">{item.description}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const visibleCounts = showZeroCounts ? (countItems ?? []) : (countItems ?? []).filter((item) => item.value > 0);
  if (visibleCounts.length === 0) {
    return <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">{emptyMessage}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {visibleCounts.map((item) => {
        const isZero = item.value === 0;
        const content = (
          <>
            <span className={`text-lg font-bold ${isZero ? 'text-text-secondary' : 'text-warning'}`}>{item.value}</span>
            <span className="text-sm font-medium text-text-primary">{item.label}</span>
          </>
        );
        const chipClass = isZero
          ? 'flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2'
          : 'flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-light px-3 py-2';
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={`${chipClass} transition ${isZero ? 'hover:bg-surface-hover' : 'hover:border-warning'} focus:outline-none focus:ring-2 focus:ring-focus`}
          >
            {content}
          </Link>
        ) : (
          <div key={item.label} className={chipClass}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
