import type { LucideIcon } from 'lucide-react';

export type DashboardKpiTone = 'neutral' | 'warning' | 'error' | 'success';

interface DashboardKpiCardProps {
  label: string;
  /** `null`/`undefined` renders "—" (data unavailable) — never a fabricated 0. */
  value: number | null | undefined;
  icon: LucideIcon;
  tone?: DashboardKpiTone;
}

const ICON_TONE: Record<DashboardKpiTone, string> = {
  neutral: 'text-text-muted', warning: 'text-warning', error: 'text-error', success: 'text-success',
};
const VALUE_TONE: Record<DashboardKpiTone, string> = {
  neutral: 'text-text-primary', warning: 'text-warning', error: 'text-error', success: 'text-success',
};

/**
 * FMP-UI-35 — the one KPI tile shape shared by all 5 piece-flow dashboards
 * (Contract Management, Technical, Production & Planning, Storage Yard &
 * Delivery, Erection). Before this unit, Contract Management/Production/
 * Storage/Erection each had their OWN copy of this exact same inline
 * markup (built one dashboard at a time across FMP-UI-29/32/33/34, never
 * factored out), and Technical had a visibly different one (`TechnicalKpiCard`
 * — bigger padding, a colored icon chip, a 3rd helper-text line, smaller
 * number/bigger label than the other 4). This component is that one
 * shared shape; `TechnicalKpiCard` is retired in favor of it (FMP-UI-35).
 *
 * Deliberately plain — no icon chip/background, no colored top bar, no
 * helper-text line, no `min-h` floor: the simpler of the 2 pre-existing
 * styles, matching the 4 dashboards that already agreed on it rather than
 * the 1 that didn't.
 */
export function DashboardKpiCard({ label, value, icon: Icon, tone = 'neutral' }: DashboardKpiCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <Icon className={`mb-1.5 size-4 ${ICON_TONE[tone]}`} aria-hidden="true" />
      <p className={`text-2xl font-bold leading-none ${VALUE_TONE[tone]}`}>{value ?? '—'}</p>
      <p className="mt-1 text-xs font-medium text-text-secondary">{label}</p>
    </div>
  );
}
