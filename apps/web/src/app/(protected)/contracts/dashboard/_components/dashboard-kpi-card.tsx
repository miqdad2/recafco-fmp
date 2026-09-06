import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { MetricStatus } from '../../../_components/metric-card';

// CM-54 — approved-design KPI card: colorful icon in a soft circle, large
// value, label, subtext, and an optional secondary line (breakdown chips or
// a single "Original: KWD X" style fact). Distinct from ../../../_components/metric-card.tsx
// (kept for the other dashboards / legacy fallback) — this one adds the
// icon-circle + secondary-line slots the approved screenshot needs.
// CM-54C — visual-only polish pass: larger icon circle, bolder value
// typography, a touch more breathing room, and a subtle hover lift — but
// ONLY when the card is actually a link (href present); a non-clickable
// card never gains hover/lift styling, so there is no fake interactivity.
// CM-54D — final tightening: pulled padding/icon circle back down a notch
// (CM-54C leaned slightly too roomy) so cards read as compact rather than
// tall, while keeping the value prominent and the icon circle consistent
// across every card. Secondary line lightened further (no border, just a
// muted continuation line) so it reads as a quiet footnote, not a divider.
// CM-58B — optional `dense` prop: a horizontal (icon left, value+label
// right) layout for KPI strips that need a shorter row (e.g. Contract
// Detail Payments). Defaults to false, so every existing dashboard
// consumer's vertical icon-on-top layout is completely unchanged.
// CM-60B — optional `valueClassName` prop: overrides the big value's text
// color (default text-text-primary) for KPI strips that need the number
// itself color-coded, not just the icon circle (e.g. Contract Detail
// Variations — a green Approved value, an amber Pending value, a red
// Rejected/Cancelled value). Undefined by default, so every existing
// consumer's plain text-text-primary value is completely unchanged.

export type KpiAccent = 'accent' | 'success' | 'warning' | 'error' | 'info' | 'team-production' | 'teal';

const ACCENT_CLASSES: Record<KpiAccent, string> = {
  accent: 'bg-accent-light text-accent',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  error: 'bg-error-light text-error',
  info: 'bg-info-light text-info',
  'team-production': 'bg-team-production-light text-team-production',
  teal: 'bg-teal-light text-teal',
};

export interface DashboardKpiCardProps {
  label: string;
  value: string | number | undefined;
  icon: LucideIcon;
  accent: KpiAccent;
  subtext?: string | undefined;
  secondaryLine?: string | undefined;
  href?: string | undefined;
  status: MetricStatus;
  dense?: boolean;
  valueClassName?: string | undefined;
}

export function DashboardKpiCard({
  label, value, icon: Icon, accent, subtext, secondaryLine, href, status, dense = false, valueClassName,
}: DashboardKpiCardProps): React.JSX.Element {
  const isClickable = Boolean(href) && status === 'ok';
  const valueColorClass = valueClassName ?? 'text-text-primary';

  const body = dense ? (
    <div
      className={`bg-surface rounded-xl border border-border shadow-sm h-full flex items-center gap-3 p-3.5 transition-shadow duration-150 ${isClickable ? 'group-hover:shadow-md group-hover:border-border-strong' : ''}`}
    >
      <span className={`inline-flex items-center justify-center size-10 rounded-full shrink-0 ${ACCENT_CLASSES[accent]}`}>
        <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={`text-xl font-bold leading-none tracking-tight truncate ${valueColorClass}`}>
          {status === 'ok' ? (value ?? '—') : '—'}
        </p>
        <p className="text-xs font-medium text-text-secondary mt-1 truncate">{label}</p>
        {subtext && <p className="text-[11px] text-text-muted leading-snug mt-0.5 truncate">{subtext}</p>}
      </div>
    </div>
  ) : (
    <div
      className={`bg-surface rounded-xl border border-border shadow-sm h-full flex flex-col p-4 gap-2 transition-shadow duration-150 ${isClickable ? 'group-hover:shadow-md group-hover:border-border-strong' : ''}`}
    >
      <span className={`inline-flex items-center justify-center size-9 rounded-full shrink-0 ${ACCENT_CLASSES[accent]}`}>
        <Icon className="size-4.5" strokeWidth={2} aria-hidden="true" />
      </span>
      <div>
        <p className={`text-2xl font-bold leading-none tracking-tight ${valueColorClass}`}>
          {status === 'ok' ? (value ?? '—') : '—'}
        </p>
        <p className="text-xs font-medium text-text-secondary mt-1">{label}</p>
      </div>
      {subtext && <p className="text-[11px] text-text-muted leading-snug">{subtext}</p>}
      {secondaryLine && (
        <p className="text-[11px] text-text-muted/90 leading-snug mt-auto pt-1.5">{secondaryLine}</p>
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Link
        href={href as string}
        className="group block h-full rounded-xl transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {body}
      </Link>
    );
  }
  return <div className="h-full">{body}</div>;
}
