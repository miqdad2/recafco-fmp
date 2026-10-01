import { WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TechnicalKpiAccent = 'neutral' | 'info' | 'secondary' | 'warning' | 'module' | 'success' | 'error';

interface Props {
  label: string;
  value: number | undefined;
  helperText: string;
  icon: LucideIcon;
  accent: TechnicalKpiAccent;
  hasData: boolean;
}

const ACCENT_CLASSES: Record<TechnicalKpiAccent, { chip: string; bar: string }> = {
  neutral: { chip: 'bg-surface-secondary text-text-muted', bar: 'border-t-border-strong' },
  info: { chip: 'bg-info-light text-info', bar: 'border-t-info' },
  secondary: { chip: 'bg-secondary-accent-light text-secondary-accent', bar: 'border-t-secondary-accent' },
  warning: { chip: 'bg-warning-light text-warning', bar: 'border-t-warning' },
  module: { chip: 'bg-module-technical-light text-module-technical', bar: 'border-t-module-technical' },
  success: { chip: 'bg-success-light text-success', bar: 'border-t-success' },
  error: { chip: 'bg-error-light text-error', bar: 'border-t-error' },
};

/**
 * FMP-TECH-05 — a Technical-specific KPI tile: icon chip + tint + colored
 * top accent bar + a short helper line explaining what the count means, so
 * a manager can read the whole board without hovering anything. Deliberately
 * NOT the shared `MetricCard` (used by 23+ other dashboards app-wide) — a
 * local near-duplicate keeps this dashboard's own polish from touching
 * unrelated modules, same reasoning every per-stage attachment panel in this
 * app already uses. Not wrapped in a `<Link>`: no real per-metric filtered
 * view exists on this page today, and the ticket explicitly says not to
 * fake a filtering affordance that doesn't do anything.
 */
export function TechnicalKpiCard({ label, value, helperText, icon: Icon, accent, hasData }: Props): React.JSX.Element {
  const { chip, bar } = ACCENT_CLASSES[accent];

  return (
    // FMP-TECH-05P — tightened padding/icon/value size for a more compact
    // 7-across row, and `min-h-[6.5rem]` so a 2-line helper on one card
    // (e.g. a long urgent-count sentence) doesn't throw off row alignment
    // with its neighbors.
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
      <p className="mt-2.5 text-xl font-bold leading-none text-text-primary">{hasData ? value ?? 0 : '—'}</p>
      <p className="mt-1.5 text-sm font-semibold text-text-primary">{label}</p>
      <p className="mt-0.5 text-xs leading-snug text-text-muted">{helperText}</p>
    </div>
  );
}
