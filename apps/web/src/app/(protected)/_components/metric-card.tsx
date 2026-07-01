import Link from 'next/link';
import { Lock, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MetricStatus = 'ok' | 'restricted' | 'unavailable';

export interface MetricCardProps {
  label: string;
  value?: string | number | undefined;
  icon: LucideIcon;
  iconColor?: string | undefined;
  href?: string | undefined;
  status: MetricStatus;
  source?: string | undefined;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-accent',
  href,
  status,
  source,
}: MetricCardProps): React.JSX.Element {
  const inner = (
    <div className="bg-surface rounded-lg border border-border p-5 shadow-sm h-full flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className={`${iconColor} shrink-0`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {status === 'restricted' && (
          <span className="inline-flex items-center gap-1 text-xs text-text-muted bg-surface-secondary px-2 py-0.5 rounded-full">
            <Lock className="size-3" aria-hidden="true" />
            Restricted
          </span>
        )}
        {status === 'unavailable' && (
          <span className="inline-flex items-center gap-1 text-xs text-text-muted bg-surface-secondary px-2 py-0.5 rounded-full">
            <WifiOff className="size-3" aria-hidden="true" />
            Unavailable
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold text-text-primary leading-none">
          {status === 'ok' ? (value ?? '—') : '—'}
        </p>
        <p className="text-sm text-text-secondary mt-1">{label}</p>
      </div>
      {source && (
        <p className="text-xs text-text-muted mt-auto">{source}</p>
      )}
    </div>
  );

  if (href && status === 'ok') {
    return (
      <Link
        href={href}
        className="block hover:border-border-strong hover:shadow-md transition-all rounded-lg focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {inner}
      </Link>
    );
  }

  return <div>{inner}</div>;
}
