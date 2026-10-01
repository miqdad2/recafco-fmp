import { WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MmsKpiAccent = 'neutral' | 'teal' | 'info' | 'secondary' | 'warning' | 'success' | 'error';

interface Props {
  label: string;
  /** null = this metric cannot be computed for this user/data (shown as `unavailableText`). */
  value: number | null;
  helperText: string;
  icon: LucideIcon;
  accent: MmsKpiAccent;
  /** false = no live data at all (MMS offline / not configured / restricted). */
  hasData: boolean;
  unavailableText?: string | undefined;
}

const ACCENT_CLASSES: Record<MmsKpiAccent, { chip: string; bar: string }> = {
  neutral: { chip: 'bg-surface-secondary text-text-muted', bar: 'border-t-border-strong' },
  teal: { chip: 'bg-teal-light text-teal', bar: 'border-t-teal' },
  info: { chip: 'bg-info-light text-info', bar: 'border-t-info' },
  secondary: { chip: 'bg-secondary-accent-light text-secondary-accent', bar: 'border-t-secondary-accent' },
  warning: { chip: 'bg-warning-light text-warning', bar: 'border-t-warning' },
  success: { chip: 'bg-success-light text-success', bar: 'border-t-success' },
  error: { chip: 'bg-error-light text-error', bar: 'border-t-error' },
};

// FMP-MAINT-01 — same visual language as TechnicalKpiCard (icon chip, top
// accent bar, helper line), kept local to Maintenance so the Technical
// dashboard is untouched. Adds a per-metric "not available" state: a metric
// MMS data can't answer for this user shows that, never a fake 0.
export function MmsKpiCard({ label, value, helperText, icon: Icon, accent, hasData, unavailableText }: Props): React.JSX.Element {
  const { chip, bar } = ACCENT_CLASSES[accent];
  const metricUnavailable = hasData && value === null;

  return (
    <div className={`flex min-h-[6.5rem] flex-col rounded-xl border border-border ${bar} border-t-[3px] bg-surface p-3.5 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${chip}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {!hasData && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-text-muted">
            <WifiOff className="size-3" aria-hidden="true" />
            Unavailable
          </span>
        )}
      </div>
      <p className="mt-2.5 text-xl font-bold leading-none text-text-primary">{hasData && value !== null ? value : '—'}</p>
      <p className="mt-1.5 text-sm font-semibold text-text-primary">{label}</p>
      <p className="mt-0.5 text-xs leading-snug text-text-muted">
        {metricUnavailable ? (unavailableText ?? 'Not available from MMS data yet') : helperText}
      </p>
    </div>
  );
}
