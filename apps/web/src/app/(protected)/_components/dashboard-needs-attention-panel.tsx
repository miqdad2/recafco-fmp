import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface DashboardAttentionRow {
  label: string;
  value: number;
  tone: 'error' | 'warning' | 'neutral';
  /** Optional — when present, the row is a real link (e.g. to the same module's piece screen, pre-filtered); otherwise a plain row. */
  href?: string;
}

interface DashboardNeedsAttentionPanelProps {
  rows: DashboardAttentionRow[];
  /** Default matches this unit's own required wording exactly. */
  emptyMessage?: string;
}

/**
 * FMP-UI-35 — the one Needs Attention panel shape shared by all 5 piece-
 * flow dashboards. Before this unit, Contract Management's was inline in
 * its own page.tsx (never collapsed to a single empty-state message —
 * always showed all 6 rows even when every one was 0), Technical's said
 * "All Technical workflow items are currently on track.", and Production's/
 * Storage's/Erection's each had their own near-identical component saying
 * "Every piece is on track — nothing needs attention right now." — 3
 * different empty-state sentences and 1 page that never showed one at all.
 * This component is the one shape all 5 now use, with the exact wording
 * this unit's own ticket specified: "No urgent items." — Row spacing,
 * count alignment, and red/amber/neutral coloring are identical everywhere
 * it appears.
 */
export function DashboardNeedsAttentionPanel({ rows, emptyMessage = 'No urgent items.' }: DashboardNeedsAttentionPanelProps): React.JSX.Element {
  const allZero = rows.every((r) => r.value === 0);

  if (allZero) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-success/40 bg-success-light p-4 text-sm text-success">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-2 shadow-sm">
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const isAlert = row.tone !== 'neutral' && row.value > 0;
          const valueClass = !isAlert ? 'text-text-secondary' : row.tone === 'error' ? 'text-error' : 'text-warning';
          const content = (
            <>
              <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                {isAlert && <AlertTriangle className={`size-3.5 ${row.tone === 'error' ? 'text-error' : 'text-warning'}`} aria-hidden="true" />}
                {row.label}
              </span>
              <span className={`text-lg font-bold ${valueClass}`}>{row.value}</span>
            </>
          );
          return (
            <li key={row.label}>
              {row.href ? (
                <Link href={row.href} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
