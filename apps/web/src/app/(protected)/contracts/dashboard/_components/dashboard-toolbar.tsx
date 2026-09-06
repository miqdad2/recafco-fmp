import Link from 'next/link';
import { CalendarDays, Filter, Download, List, Workflow } from 'lucide-react';
import { DashboardScopeBadge } from '../../../_components/dashboard-scope-badge';
import { ManagerTopActions } from './manager-top-actions';
import type { ContractDashboardType, DashboardScopeType } from '@/lib/contracts-api';

interface Props {
  scope: { type: DashboardScopeType; departmentNames: string[] } | undefined;
  dashboardType: ContractDashboardType | undefined;
  canCreate: boolean;
  canClose: boolean;
}

// CM-54 — approved-design header controls. "As of Today" is a literal label
// (not a live-formatted date): this dashboard has no historical snapshot
// feature, so a real "as of <past date>" picker would be a fake capability.
// "Filters" links to the real Contract List filters (the only filtering that
// actually exists today); "Export" mirrors the disabled, honestly-labeled
// pattern already used on the Contract List page (contracts/page.tsx) —
// no fake export behavior.
export function DashboardToolbar({ scope, dashboardType, canCreate, canClose }: Props): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text-secondary">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
        As of Today
      </span>

      {dashboardType === 'MANAGER' && (
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-xs text-text-secondary hover:bg-surface-hover"
        >
          <Filter className="size-3.5 shrink-0" aria-hidden="true" />
          Filters
        </Link>
      )}

      {dashboardType === 'MANAGER' && (
        <button
          type="button"
          disabled
          title="Dashboard export is planned for a future unit"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface-secondary text-xs text-text-muted cursor-not-allowed"
        >
          <Download className="size-3.5 shrink-0" aria-hidden="true" />
          Export
        </button>
      )}

      <DashboardScopeBadge scope={scope} />

      <div className="ml-auto flex items-center gap-2">
        {dashboardType === 'MANAGER' && <ManagerTopActions canCreate={canCreate} canClose={canClose} />}
        {dashboardType === 'STAFF' && (
          <Link
            href="/contracts/workflow?mode=my-tasks"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Workflow className="size-3.5 shrink-0" aria-hidden="true" />
            View My Tasks
          </Link>
        )}
        {dashboardType === undefined && (
          <Link
            href="/contracts"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <List className="size-3.5 shrink-0" aria-hidden="true" />
            View Contract List
          </Link>
        )}
      </div>
    </div>
  );
}
