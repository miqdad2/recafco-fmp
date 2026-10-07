import type { LucideIcon } from 'lucide-react';

export type MmsKpiAccent = 'neutral' | 'teal' | 'info' | 'secondary' | 'warning' | 'success' | 'error';

interface Props {
  label: string;
  /** null = MMS did not send this metric (shown as "—" with a small "Not available yet"). */
  value: number | null;
  /** Formatted form of `value` (e.g. "12.5 h"); `value` still decides availability. */
  display?: string | undefined;
  /** Shown as a tooltip only — the one-screen layout has no room for a helper line. */
  helperText: string;
  icon: LucideIcon;
  accent: MmsKpiAccent;
  /** false = no live data at all (MMS offline / not configured / restricted). */
  hasData: boolean;
  /** Mini-stat variant for the second KPI row. */
  compact?: boolean;
}

const ACCENT_CLASSES: Record<MmsKpiAccent, { chip: string; bar: string }> = {
  neutral: { chip: 'bg-surface-secondary text-text-muted', bar: 'border-l-border-strong' },
  teal: { chip: 'bg-teal-light text-teal', bar: 'border-l-teal' },
  info: { chip: 'bg-info-light text-info', bar: 'border-l-info' },
  secondary: { chip: 'bg-secondary-accent-light text-secondary-accent', bar: 'border-l-secondary-accent' },
  warning: { chip: 'bg-warning-light text-warning', bar: 'border-l-warning' },
  success: { chip: 'bg-success-light text-success', bar: 'border-l-success' },
  error: { chip: 'bg-error-light text-error', bar: 'border-l-error' },
};

const NOT_AVAILABLE = 'Not available yet';

// FMP-MAINT-05 — one-screen KPI tiles. Two sizes, both a single horizontal
// row (icon, number, label) so six fit across without height:
// - primary: icon chip + large count + label, accent bar on the left edge.
// - compact: label left, value right — a mini-stat about half as tall.
// A metric with no value shows "—", never 0. When MMS is online but did not
// send the metric, a small "Not available yet" replaces nothing else; when
// there is no live data at all the page's single banner explains why.
export function MmsKpiCard({ label, value, display, helperText, icon: Icon, accent, hasData, compact = false }: Props): React.JSX.Element {
  const { chip, bar } = ACCENT_CLASSES[accent];
  const metricUnavailable = hasData && value === null;
  const shown = hasData && value !== null ? (display ?? value) : '—';
  const tooltip = metricUnavailable ? `${label}: ${NOT_AVAILABLE}` : helperText || label;

  if (compact) {
    return (
      <div title={tooltip} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 shadow-sm">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium leading-tight text-text-secondary 2xl:text-[13px]">
          <Icon className="hidden size-4 shrink-0 text-text-muted 2xl:block" aria-hidden="true" />
          <span className="line-clamp-2">{label}</span>
        </span>
        <span className="shrink-0 text-base font-bold tabular-nums text-text-primary">{shown}</span>
      </div>
    );
  }

  return (
    <div title={tooltip} className={`flex items-center gap-2.5 rounded-xl border border-l-[3px] border-border ${bar} bg-surface px-3 py-2 shadow-sm`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${chip}`}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold tabular-nums leading-none text-text-primary">{shown}</p>
        <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight text-text-secondary 2xl:text-[13px]">{label}</p>
        {metricUnavailable && <p className="text-xs leading-tight text-text-secondary">{NOT_AVAILABLE}</p>}
      </div>
    </div>
  );
}
