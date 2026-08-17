import Link from 'next/link';
import { CalendarDays, List } from 'lucide-react';
import { DashboardScopeBadge } from '../../../_components/dashboard-scope-badge';
import type { DashboardScopeType } from '@/lib/contracts-api';

interface Props {
  scope: { type: DashboardScopeType; departmentNames: string[] } | undefined;
}

function formatAsOfDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function DashboardToolbar({ scope }: Props): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text-secondary">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
        As of {formatAsOfDate()}
      </span>

      <DashboardScopeBadge scope={scope} />

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <List className="size-3.5 shrink-0" aria-hidden="true" />
          View Contract List
        </Link>
      </div>
    </div>
  );
}
