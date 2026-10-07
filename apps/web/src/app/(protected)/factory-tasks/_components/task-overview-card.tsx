import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  iconColor: string;
  href: string;
}

/**
 * FMP-TASK-02 — compact horizontal overview card (icon left, count + label
 * right) so all 6 task counts fit in one row. Shows "—" when the dashboard
 * data is unavailable; never a fabricated number.
 */
export function TaskOverviewCard({ label, value, icon: Icon, iconColor, href }: Props): React.JSX.Element {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-sm transition-all hover:border-border-strong hover:shadow-md focus:outline-none focus:ring-2 focus:ring-focus"
    >
      <span className={`${iconColor} shrink-0`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none text-text-primary">{value ?? '—'}</span>
        <span className="mt-1 block text-sm leading-tight text-text-secondary">{label}</span>
      </span>
    </Link>
  );
}
