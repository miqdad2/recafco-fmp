import type { LucideIcon } from 'lucide-react';
import type { MetricStatus } from '../../../_components/metric-card';

interface Props {
  label: string;
  value: number | undefined;
  helperText: string;
  icon: LucideIcon;
  iconClassName: string;
  status: MetricStatus;
  /** Soft red card treatment for the one card that should read as more urgent than the other 3 (Needs Attention). */
  attention?: boolean;
}

/**
 * FMP-UI-19E — a small, bespoke card just for this dashboard's 4 overview
 * metrics, replacing `DashboardKpiCard`'s generic `dense` layout (FMP-UI-19D)
 * so this one page can get management-ready polish (consistent icon size,
 * consistent height, a clearer value/label/helper hierarchy, and a soft
 * red "attention" tone) without touching `DashboardKpiCard` itself — that
 * component is shared by 10+ other dashboards, so a one-page visual need
 * here doesn't belong in it. Every value is still the same real number (or
 * `undefined`→'—' while `status !== 'ok'`) the caller already computed —
 * this is a presentation-only wrapper, no new data.
 */
export function ErectionOverviewCard({ label, value, helperText, icon: Icon, iconClassName, status, attention }: Props): React.JSX.Element {
  const displayValue = status === 'ok' ? (value ?? '—') : '—';

  return (
    <div
      className={
        attention
          ? 'h-full rounded-xl border border-error/30 bg-error-light/60 p-4 shadow-sm flex items-center gap-3'
          : 'h-full rounded-xl border border-border bg-surface p-4 shadow-sm flex items-center gap-3'
      }
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-none tracking-tight ${attention ? 'text-error' : 'text-text-primary'}`}>
          {displayValue}
        </p>
        <p className="text-xs font-semibold text-text-secondary mt-1 truncate">{label}</p>
        <p className="text-[11px] text-text-muted leading-snug mt-0.5 truncate" title={helperText}>{helperText}</p>
      </div>
    </div>
  );
}
