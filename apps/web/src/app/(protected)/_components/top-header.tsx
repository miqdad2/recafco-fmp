'use client';

import { Menu } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { logoutAction } from '../actions';
import { Breadcrumbs } from './breadcrumbs';
import type { BreadcrumbItem } from './breadcrumbs';
import {
  isContractWorkspaceDetailPath,
  contractModuleBreadcrumbItems,
  contractWorkflowBreadcrumbItems,
  contractErectionMethodStatementBreadcrumbItems,
  contractErectionMethodStatementApprovalBreadcrumbItems,
  contractErectionScheduleBreadcrumbItems,
  contractErectionDeliveryStartBreadcrumbItems,
  contractErectionStartBreadcrumbItems,
  contractErectionChecklistBreadcrumbItems,
} from '../_lib/contract-workspace-breadcrumb';
import { isContractStaffOnlyAccess } from '../_lib/module-visibility';
import type { ShellUser } from './app-shell';

interface TopHeaderProps {
  user: ShellUser;
  onMenuOpen: (trigger: HTMLElement) => void;
}

// CM-66D/CM-66E/CM-66F — Contract Management pages show their breadcrumb
// here, at header level beside Manager / Sign out, instead of repeating it
// in the page body: the Contract Detail workspace (Overview + tabs,
// CM-66D), the module's other STATIC list/register pages (Dashboard,
// Contract List, New Register, Schedule, Payments, Issue Log, Claim Log,
// Closeout Requests, CM-66E), and /contracts/workflow's 3 query-param-
// dependent variants (CM-66F) — each of those pages no longer renders its
// own copy. /contracts/[id]/edit is deliberately NOT covered — its
// breadcrumb includes the real contract reference number, which can't be
// derived from the URL alone. Every other protected page (Production,
// Safety, Incidents, Maintenance, Administration, Factory Tasks, etc.)
// keeps rendering its own Breadcrumbs in the page body exactly as before —
// this header slot is empty for them.
const WORKSPACE_DETAIL_BREADCRUMB: BreadcrumbItem[] = [
  { label: 'Contract Management', href: '/contracts/dashboard' },
  { label: 'Contract List', href: '/contracts' },
  { label: 'Contract Detail' },
];

// FMP-UI-04B — the Executive Dashboard's title used to live here (moved out
// of the page body so it sat "at the same visual level as the user name and
// Sign out button"). FMP-UI-14 moved it back into the dashboard's own page
// body as a proper hero heading (see `dashboard/page.tsx`) — a senior
// manager's first screen reading as "a professional platform landing
// screen" needed its own title in its own content area, not one borrowed
// from the header chrome. `EXECUTIVE_DASHBOARD_PATH` is kept only so the
// breadcrumb slot below still stays empty on this route (unchanged from
// before — this route has never had a breadcrumb of its own).
const EXECUTIVE_DASHBOARD_PATH = '/dashboard';

export function TopHeader({ user, onMenuOpen }: TopHeaderProps): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isStaffOnly = isContractStaffOnlyAccess(user.permissions);
  const isExecutiveDashboard = pathname === EXECUTIVE_DASHBOARD_PATH;
  const breadcrumbItems = isExecutiveDashboard
    ? undefined
    : (
      contractModuleBreadcrumbItems(pathname) ??
      contractWorkflowBreadcrumbItems(pathname, searchParams, isStaffOnly) ??
      contractErectionChecklistBreadcrumbItems(pathname, isStaffOnly) ??
      contractErectionStartBreadcrumbItems(pathname, isStaffOnly) ??
      contractErectionDeliveryStartBreadcrumbItems(pathname, isStaffOnly) ??
      contractErectionScheduleBreadcrumbItems(pathname, isStaffOnly) ??
      contractErectionMethodStatementApprovalBreadcrumbItems(pathname, isStaffOnly) ??
      contractErectionMethodStatementBreadcrumbItems(pathname, isStaffOnly) ??
      (isContractWorkspaceDetailPath(pathname) ? WORKSPACE_DETAIL_BREADCRUMB : undefined)
    );

  return (
    <header className="relative flex items-center justify-between h-14 px-4 bg-surface border-b border-border shrink-0 gap-3">
      {/* Mobile hamburger */}
      <MobileMenuButton onMenuOpen={onMenuOpen} />

      {/* Desktop: contract module/workspace breadcrumb when applicable, otherwise empty (sidebar provides branding) */}
      <div className="hidden md:block min-w-0 flex-1">
        {breadcrumbItems && <Breadcrumbs items={breadcrumbItems} className="mb-0" />}
      </div>

      {/* Right: user info + logout */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-text-primary leading-tight">{user.displayName}</p>
          <p className="text-xs text-text-muted leading-tight">{user.roleName}</p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="h-9 px-3 rounded-md border border-border bg-surface text-text-secondary text-sm hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

// Separate client component just for the mobile button (receives callback from AppShell)
function MobileMenuButton({
  onMenuOpen,
}: {
  onMenuOpen: (trigger: HTMLElement) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="md:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
      aria-label="Open navigation menu"
      aria-controls="mobile-nav"
      onClick={(e) => onMenuOpen(e.currentTarget)}
    >
      <Menu className="size-5" aria-hidden="true" />
    </button>
  );
}
