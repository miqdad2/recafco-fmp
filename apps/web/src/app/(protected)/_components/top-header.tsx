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
        {/* FMP-UI-25 — avatar (first letter or digit of the display name; no profile
            image exists yet) beside the name and role. Neutral surface tokens
            so it reads the same in light and dark. The avatar stays visible
            on mobile, where the name/role text is hidden; both lines
            truncate instead of pushing Sign out off the header. */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-secondary text-sm font-bold uppercase text-text-primary"
          >
            {avatarInitial(user.displayName)}
          </span>
          <div className="hidden min-w-0 max-w-48 sm:block">
            <p className="truncate text-sm font-semibold leading-tight text-text-primary">{user.displayName}</p>
            <p className="truncate text-[13px] leading-tight text-text-secondary">{user.roleName}</p>
          </div>
        </div>

        {/* FMP-UI-18 — was a neutral outline button (`border-border`/
            `bg-surface`/`text-text-secondary`) that read as just another
            quiet header control, easy to miss. Restyled with the same
            RECAFCO-red badge tokens already used app-wide for red status
            badges (`bg-accent-light`/`text-accent`, e.g.
            `workflow-task-priority-badge.tsx`'s CRITICAL badge) rather than
            a solid destructive-delete fill — a soft tinted button, not an
            alarming one. Hover inverts to a solid `bg-accent` fill with
            `text-accent-foreground` (white) for a clear, unambiguous
            pressed-state cue. Font bumped to `font-semibold` (was no
            weight class) for easier reading at a glance. Focus ring kept on
            this app's one standard focus token (`ring-focus`/
            `ring-offset-2`), unchanged from every other header/executive
            button — not `ring-accent`, so a normal focus pass never reads
            as an error state. `bg-accent-light`/`text-accent` are not
            re-tinted between themes (see globals.css's own documented
            light/dark-mode note), so this button renders identically
            checked in both — same as every other red badge in the app
            already does, with no washed-out/overly-bright regression. */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-9 px-4 rounded-lg border border-accent/30 bg-accent-light text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

/** First letter or digit of the name ("[UAT] Manager" → "U"); "?" when there is none. */
function avatarInitial(displayName: string): string {
  return displayName.match(/[\p{L}\p{N}]/u)?.[0] ?? '?';
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
