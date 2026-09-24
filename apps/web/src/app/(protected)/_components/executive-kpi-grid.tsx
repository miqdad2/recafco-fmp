import type { LucideIcon } from 'lucide-react';
import { MetricCard } from './metric-card';

interface Props {
  /** Every field rendered exactly as returned by that module's own real dashboard API — nothing summarized or recomputed, nothing added. */
  metrics: Record<string, number | null | undefined>;
  icon: LucideIcon;
  /**
   * FMP-UI-16 — force a fixed column count instead of the default
   * responsive 2/3/4 escalation. Needed when this grid sits inside a
   * narrower half-width column (e.g. side-by-side with a "Needs Attention"
   * panel) rather than the page's full width — the default breakpoints key
   * off VIEWPORT width, so on a real desktop screen they'd still try to
   * force 4 columns into a space only wide enough for 2. Optional; every
   * existing caller keeps the original responsive behavior.
   */
  columns?: 2 | 3 | 4;
  /**
   * FMP-UI-16B — forwarded straight to each `MetricCard` for a tighter,
   * more compact tile (smaller icon/number/padding — see `MetricCard`'s
   * own `dense` prop). Useful together with `columns` when this grid sits
   * in a narrower column (e.g. the ~65% "Summary" side of a two-column
   * executive layout). Optional; defaults to `MetricCard`'s own default
   * (`false`), so every existing caller is unaffected.
   */
  dense?: boolean;
}

/** camelCase field name -> "Title Case" label — formatting only, no invented wording. */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Color hint from the field's own name (overdue/critical -> danger, open/pending/waiting/paused/blocked -> warning, completed/resolved/closed/ready -> success) — never a fabricated business judgment, just a reading aid. */
function iconColorFor(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('overdue') || k.includes('critical') || k.includes('blocked')) return 'text-error';
  if (k.includes('open') || k.includes('pending') || k.includes('waiting') || k.includes('paused') || k.includes('progress')) return 'text-warning';
  if (k.includes('completed') || k.includes('resolved') || k.includes('closed') || k.includes('ready')) return 'text-success';
  return 'text-accent';
}

/**
 * FMP-UI-07 — the Executive Module Landing Page's KPI section. Renders every
 * metric field a module's own dashboard API already returns, formatted for
 * senior-friendly reading (large number, plain-English label). A `null`
 * value renders MetricCard's honest "Unavailable" state, never a fabricated
 * number — same rule the Executive Dashboard cards already follow.
 */
const FIXED_COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export function ExecutiveKpiGrid({ metrics, icon, columns, dense }: Props): React.JSX.Element {
  const entries = Object.entries(metrics);
  const gridClass = columns ? FIXED_COLUMN_CLASS[columns] : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {entries.map(([key, value]) => (
        <MetricCard
          key={key}
          label={humanizeKey(key)}
          value={value ?? undefined}
          icon={icon}
          iconColor={iconColorFor(key)}
          status={value === null || value === undefined ? 'unavailable' : 'ok'}
          dense={dense}
        />
      ))}
    </div>
  );
}
