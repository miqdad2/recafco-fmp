'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  FileText,
  Factory,
  FileSearch,
  Settings,
  Users,
  Shield,
  Building2,
  MapPin,
  Calendar,
  Workflow,
  HardHat,
  Ruler,
  Wallet,
  AlertCircle,
  Receipt,
  ClipboardCheck,
  BadgeCheck,
  Warehouse,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import type { ShellUser } from './app-shell';
import type { LucideIcon } from 'lucide-react';
import { canSeeModule, isContractManagementOnlyAccess, isContractStaffOnlyAccess, isErectionDashboardMonitorOnly, isExecutiveManagerAccess } from '../_lib/module-visibility';
import type { ModuleCode } from '../_lib/module-visibility';

interface NavItem {
  label: string;
  href: string | null;
  icon: LucideIcon;
  comingSoon?: boolean;
  /** Gates visibility via the shared canSeeModule() source of truth. Used for Operations/Contract items and whole-module checks. */
  module?: ModuleCode;
  /** Gates visibility by an exact permission code — used where a module has several screens, each needing its own specific permission (e.g. Administration's individual items). */
  permission?: string;
  /** Gates visibility by ANY of several permission codes (OR) — used where more than one role/permission tier should see an item (e.g. Closeout Requests: Contract Manager via contracts.update, or a contracts.close-only actor). Mirrors the backend's @AnyPermission decorator. */
  anyPermission?: string[];
  /** Gated behind the same visibility as the Administration section (no dedicated permission exists yet). */
  adminGated?: boolean;
}

/** Single visibility rule for every sidebar item — the one place "can this user see this link" is decided. */
function isNavItemVisible(item: NavItem, permissions: string[], hasAnyAdminPermission: boolean): boolean {
  if (item.module && !canSeeModule(permissions, item.module)) return false;
  if (item.permission && !permissions.includes(item.permission)) return false;
  if (item.anyPermission && !item.anyPermission.some((p) => permissions.includes(p))) return false;
  if (item.adminGated && !hasAnyAdminPermission) return false;
  return true;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

// FMP-UI-01 — Technical and Erection are promoted to their own top-level
// sidebar entries (positions 3 and 4 in the required module order), even
// though they are sub-views of Contract Management with no dedicated
// permission — gated by the same CONTRACTS_MANAGEMENT module check as the
// Contract Management dropdown itself. They render first in this array so
// they appear immediately after that dropdown (see the group-rendering loop
// below, which renders the dropdown before this array's items).
const MAIN_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Technical', href: '/contracts/technical', icon: Ruler, module: 'CONTRACTS_MANAGEMENT' },
      { label: 'Erection', href: '/contracts/erection-dashboard', icon: HardHat, module: 'CONTRACTS_MANAGEMENT' },
      { label: 'Safety & Compliance', href: '/safety-compliance/dashboard', icon: ShieldCheck, module: 'SAFETY_COMPLIANCE' },
      { label: 'Incident Report', href: '/incidents/dashboard', icon: AlertTriangle, module: 'INCIDENT_REPORT' },
      { label: 'Production Planning', href: '/production/dashboard', icon: Factory, module: 'PRODUCTION_DASHBOARD' },
      { label: 'Maintenance Management', href: '/maintenance/dashboard', icon: Wrench, module: 'MAINTENANCE_REQUESTS' },
      { label: 'Task Management', href: '/factory-tasks/dashboard', icon: ClipboardList, module: 'FACTORY_TASKS' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Audit Log', href: null, icon: FileSearch, comingSoon: true, adminGated: true },
    ],
  },
];

const CONTRACT_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/contracts/dashboard', icon: LayoutDashboard, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'Contract List', href: '/contracts', icon: FileText, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'Schedule', href: '/contracts/schedule', icon: Calendar, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'Workflow & Team Tasks', href: '/contracts/workflow', icon: Workflow, module: 'CONTRACTS_MANAGEMENT' },
  // CM-71B — visible to the same audience as every other CONTRACT_ITEMS
  // entry (contracts.read via the shared CONTRACTS_MANAGEMENT module gate);
  // no new role/permission was added for this dashboard, per that unit's
  // own "do not add a new role immediately" instruction. Also present in
  // CONTRACT_STAFF_ITEMS below as of CM-71H.1 — see that array's own doc
  // comment for why.
  { label: 'Erection Dashboard', href: '/contracts/erection-dashboard', icon: HardHat, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'Payments', href: '/contracts/payments', icon: Wallet, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'Issue Log', href: '/contracts/issues', icon: AlertCircle, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'Claim Log', href: '/contracts/claims', icon: Receipt, module: 'CONTRACTS_MANAGEMENT' },
  {
    label: 'Closeout Requests',
    href: '/contracts/closeouts',
    icon: ClipboardCheck,
    module: 'CONTRACTS_MANAGEMENT',
    // Contract Manager/Admin/Super Admin/legacy Contract Management User all carry
    // contracts.update; a contracts.close-only actor (should one ever exist) is also
    // covered. Contract Staff (contracts.workflow_update only, no contracts.update/close)
    // does not see this item — the module-level closeout register is a manager tool.
    anyPermission: ['contracts.update', 'contracts.close'],
  },
];

/**
 * CM-41 — Contract Staff (contracts.workflow_update, no contracts.update/close —
 * see isContractStaffOnlyAccess) get this short list instead of CONTRACT_ITEMS:
 * they only ever work assigned workflow tasks, never the manager-tier register/
 * payments/issue/claim/closeout tools. "My Schedule" was considered but deferred
 * (see progress-tracker.md CM-41 entry) — ShellUser doesn't carry the actor's
 * own id today, so a properly self-filtered schedule link isn't a trivial add.
 *
 * CM-71H.1 — Erection Dashboard added here too: an "Erection Manager /
 * Workflow Owner" user IS a Contract-Staff-tier account (see the new-user-
 * wizard's own ERECTION_MANAGER template, which maps to the CONTRACT_STAFF
 * role), so without this addition an assigned Erection Manager would
 * structurally never be able to reach their own dashboard. The dashboard
 * itself already filters to only the current user's assigned contracts for
 * a non-manager-tier viewer (contract-erection-dashboard.service.ts's own
 * scopedContracts logic, CM-71H) — an unassigned Contract Staff user simply
 * sees an empty work queue (ErectionEmptyState), never another user's
 * contracts, so showing this link to every Contract Staff user (not just
 * ones already known to be assigned) is safe: nothing is leaked, and the
 * common case (this IS how an Erection Manager gets access at all) is what
 * actually needs to work.
 */
const CONTRACT_STAFF_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/contracts/dashboard', icon: LayoutDashboard, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks', icon: Workflow, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'Erection Dashboard', href: '/contracts/erection-dashboard', icon: HardHat, module: 'CONTRACTS_MANAGEMENT' },
];

/**
 * FMP-UI-01 — Technical/Erection links reused verbatim inside the flat
 * Contract-Management-only section (see the group-filter above for why they
 * are excluded from the generic Operations rendering in that case). Gating
 * is already guaranteed by the caller only rendering this list when
 * contractManagementOnly is true (which itself requires contracts.read).
 */
const TECHNICAL_AND_ERECTION_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Technical', href: '/contracts/technical', icon: Ruler },
  { label: 'Erection', href: '/contracts/erection-dashboard', icon: HardHat },
];

/**
 * FMP-UI-03 — the flat, larger-type nav shown only when isExecutiveManagerAccess()
 * is true (see that function's own doc comment). No "Dashboard" link — that
 * IS the landing page for this shape (root `/` already redirects there), and
 * no per-item gating is needed: isExecutiveManagerAccess() already requires
 * every one of these 6 modules' own read permission to be true, so all 8
 * entries are always valid together. Contract Management is a single flat
 * link here (unlike CONTRACT_ITEMS' 9-item dropdown) — Executive Manager
 * gets the module's own dashboard, not the full manager register toolset,
 * matching the task's literal "keep only these 8 items" sidebar spec.
 */
// FMP-UI-07 — these now point to each module's Executive Module Landing Page
// (see _lib/executive-modules.ts, the single source of truth these hrefs are
// kept in sync with) instead of straight into the full operational
// dashboard, so the Executive Manager persona always lands on the
// simplified senior-friendly overview first — matching the Executive
// Dashboard's own card buttons, which now route the same way.
// FMP-UI-10 — QA/QC and Storage & Delivery added right after Erection, per
// this unit's own spec. Both are placeholder modules with no dedicated
// permission (see _lib/executive-modules.ts's isVisible for the real
// gating logic on the dashboard cards themselves) — shown here purely
// because this whole sidebar section already only renders under
// isExecutiveManagerAccess (below), the exact "executive-only access rule"
// this unit's own instruction allows using for now.
const EXECUTIVE_SIDEBAR_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Contract Management', href: '/contracts/executive', icon: FileText },
  { label: 'Technical', href: '/contracts/technical', icon: Ruler },
  { label: 'Erection', href: '/contracts/erection-executive', icon: HardHat },
  { label: 'Quality Assurance & Control', href: '/executive/qaqc', icon: BadgeCheck },
  { label: 'Storage Yard & Delivery', href: '/executive/storage-delivery', icon: Warehouse },
  { label: 'Safety & Compliance', href: '/safety-compliance/executive', icon: ShieldCheck },
  { label: 'Incident Report', href: '/incidents/executive', icon: AlertTriangle },
  { label: 'Production Planning', href: '/production/executive', icon: Factory },
  { label: 'Maintenance Management', href: '/maintenance/executive', icon: Wrench },
  { label: 'Task Management', href: '/factory-tasks/executive', icon: ClipboardList },
];

/** Fixed module-level slugs directly under /contracts — anything else (an id, /new, /schedule sub-routes, etc.) belongs to Contract List's active state, not a sibling summary page. */
const CONTRACT_TOP_LEVEL_SLUGS = ['dashboard', 'schedule', 'workflow', 'payments', 'issues', 'claims', 'closeouts', 'erection-dashboard', 'technical', 'executive', 'erection-executive'];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/administration/dashboard', icon: Settings },
  { label: 'Users', href: '/administration/users', icon: Users, permission: 'users.read' },
  { label: 'Roles', href: '/administration/roles', icon: Shield, permission: 'roles.read' },
  { label: 'Departments', href: '/administration/departments', icon: Building2, permission: 'org.departments.read' },
  { label: 'Plants', href: '/administration/plants', icon: Factory, permission: 'org.plants.read' },
  { label: 'Locations', href: '/administration/locations', icon: MapPin, permission: 'org.locations.read' },
];

/**
 * Contract List is active for /contracts itself and any sub-route that isn't one of the
 * other fixed module-level pages (Dashboard, Schedule, Payments, Issue Log, Claim Log) —
 * this covers /contracts/new and individual /contracts/{id}/... detail pages. Every other
 * item matches on its own exact path (or a sub-route of it) — the query string, if any
 * (e.g. Contract Staff's "My Tasks" → /contracts/workflow?mode=my-tasks), is stripped
 * first since `pathname` never includes one.
 */
function isContractItemActive(href: string, pathname: string): boolean {
  if (href === '/contracts') {
    if (pathname === '/contracts') return true;
    if (!pathname.startsWith('/contracts/')) return false;
    const firstSegment = pathname.slice('/contracts/'.length).split('/')[0];
    return !CONTRACT_TOP_LEVEL_SLUGS.includes(firstSegment ?? '');
  }
  const hrefPath = href.split('?')[0]!;
  return pathname === hrefPath || pathname.startsWith(hrefPath + '/');
}

interface SidebarProps {
  user: ShellUser;
  mobileOpen: boolean;
  onClose: () => void;
  pathname: string;
}

function isActive(href: string, pathname: string): boolean {
  // Exact match only — the generic suffix rule below would otherwise compute
  // an empty base ('') for this exact href and match every pathname (every
  // path starts with '/').
  if (href === '/dashboard') return pathname === '/dashboard';
  // FMP-UI-07 — '/executive' gets the same "also match the bare module base"
  // treatment '/dashboard' already had: EXECUTIVE_SIDEBAR_ITEMS now points
  // to each module's landing page (e.g. /safety-compliance/executive), and
  // this keeps the sidebar item highlighted while viewing a record reached
  // from it (e.g. /safety-compliance/{id}), exactly as it did before for
  // /dashboard-suffixed hrefs.
  const suffix = href.endsWith('/dashboard') ? '/dashboard' : href.endsWith('/executive') ? '/executive' : null;
  if (suffix) {
    const base = href.slice(0, -suffix.length);
    return pathname === href || pathname === base || pathname.startsWith(base + '/');
  }
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * FMP-UI-03 — isActive()'s generic "/dashboard suffix -> whole base is active"
 * rule (above) assumes the base prefix belongs to one module alone (true for
 * e.g. /factory-tasks). /contracts is NOT one of those — Technical, Erection,
 * Schedule, Payments etc. all live under it as siblings with their own
 * EXECUTIVE_SIDEBAR_ITEMS entries — so treating all of /contracts/* as
 * "Contract Management is active" would wrongly highlight it while viewing
 * Technical or Erection. Only the exact-match branch is correct here.
 */
function isExecutiveItemActive(href: string, pathname: string): boolean {
  // FMP-UI-07 — Contract Management's item now points to /contracts/executive
  // (was /contracts/dashboard); isActive()'s generic '/executive'-suffix rule
  // would otherwise strip it down to the bare '/contracts' base and wrongly
  // mark this item active while viewing Technical or Erection (its own
  // sibling EXECUTIVE_SIDEBAR_ITEMS entries under /contracts/*) — same reason
  // this override existed for /contracts/dashboard before.
  if (href === '/contracts/executive') {
    return pathname === '/contracts/executive' || pathname.startsWith('/contracts/executive/');
  }
  return isActive(href, pathname);
}

export function Sidebar({ user, mobileOpen, onClose, pathname }: SidebarProps): React.JSX.Element {
  const isInContracts = pathname.startsWith('/contracts');
  const [contractsExpanded, setContractsExpanded] = useState(isInContracts);

  // Re-expand when navigating into contracts
  useEffect(() => {
    if (isInContracts) setContractsExpanded(true);
  }, [isInContracts]);

  // The Administration section as a whole requires at least one real admin permission —
  // individual items below still each require their own specific permission via isNavItemVisible.
  const hasAnyAdminPermission = canSeeModule(user.permissions, 'ADMINISTRATION');

  const visibleAdminItems = ADMIN_ITEMS.filter(
    (item) => isNavItemVisible(item, user.permissions, hasAnyAdminPermission),
  );

  const hasAnyContractPermission = canSeeModule(user.permissions, 'CONTRACTS_MANAGEMENT');

  // CM-41 — Contract Staff get the short Dashboard/My Tasks list; everyone else
  // with Contract Management access (Manager, legacy CONTRACT_MANAGEMENT_USER,
  // Admin/Super Admin) keeps the full CONTRACT_ITEMS set, unchanged.
  const contractStaffOnly = isContractStaffOnlyAccess(user.permissions);
  const contractItemsSource = contractStaffOnly ? CONTRACT_STAFF_ITEMS : CONTRACT_ITEMS;

  // CM-71H — relabels "Erection Dashboard" to "Erection Status" for a
  // manager-tier viewer, without hiding or moving the link (see
  // isErectionDashboardMonitorOnly's own doc comment for why relabeling was
  // chosen over hiding).
  const erectionDashboardMonitorOnly = isErectionDashboardMonitorOnly(user.permissions);
  const visibleContractItems = contractItemsSource
    .filter((item) => isNavItemVisible(item, user.permissions, hasAnyAdminPermission))
    .map((item) => (
      item.href === '/contracts/erection-dashboard' && erectionDashboardMonitorOnly
        ? { ...item, label: 'Erection Status' }
        : item
    ));

  // A user who can only see Contract Management gets a flattened, dropdown-free sidebar:
  // no duplicate top-level Dashboard link, and Contract Management becomes its own
  // top-level section instead of a nested group under Operations.
  const contractManagementOnly = isContractManagementOnlyAccess(user.permissions);

  // FMP-UI-03 — Executive Manager gets a dedicated flat, larger-type nav
  // (see isExecutiveManagerAccess's own doc comment and EXECUTIVE_SIDEBAR_ITEMS
  // above). Every other persona's rendering below is completely untouched.
  const executiveMode = isExecutiveManagerAccess(user.permissions);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand — FMP-UI-09: a full white panel here (FMP-UI-07's fix)
          read as a large logo disconnected from the dark sidebar, so this is
          back to a compact, dark-background brand row: only the logo itself
          sits in a small white chip (~44px wide, just enough for its dark
          elements to keep contrast — see that same rule on the login page
          and Sidebar's own history), with "RECAFCO FMP" + a small subtitle
          in light text beside it, matching the sidebar's own dark theme. */}
      <div className="flex items-center justify-between h-16 px-4 shrink-0 border-b border-nav-hover">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
          onClick={onClose}
        >
          <span className="flex shrink-0 items-center justify-center rounded-md bg-white p-1">
            <img src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} className="h-auto w-11" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-text-inverse">RECAFCO FMP</span>
            <span className="text-[10px] text-text-inverse/60">Factory Management</span>
          </span>
        </Link>
        <button
          type="button"
          className="md:hidden text-text-inverse/70 hover:text-text-inverse p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5" aria-label="Primary navigation">
        {executiveMode ? (
          // FMP-UI-03 — flat 8-item list only, larger type/icon/spacing, no
          // "Dashboard" link (this IS the landing page), no dropdown, no
          // Administration section (Executive Manager holds no admin
          // permission, so hasAnyAdminPermission is already false for them).
          <div className="px-2 space-y-1.5">
            {EXECUTIVE_SIDEBAR_ITEMS.map((item) => {
              const active = isExecutiveItemActive(item.href, pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    // FMP-UI-04 — items-start (not items-center) + a small icon
                    // top-margin so a 2-word label that wraps (e.g. "Maintenance
                    // Management" at this width) still reads as intentional,
                    // top-aligned with the icon, rather than the icon floating
                    // in the vertical middle of two lines.
                    // FMP-UI-05 — rounded-r-md only (not rounded-md) so the
                    // active indicator's left border sits flush against the
                    // sidebar's edge instead of curving away from it.
                    // FMP-UI-10C — py-3→py-3.5 and gap-3.5→gap-3 (item spacing
                    // container also went space-y-1→space-y-1.5) now that
                    // "Quality Assurance & Control"/"Storage Yard & Delivery"
                    // are long enough to reliably wrap to 2 lines at this
                    // sidebar width — the extra vertical padding keeps a
                    // wrapped label from reading as cramped against its
                    // neighbors, and leading-snug (1.375) sits inside this
                    // unit's own requested 1.25–1.35 range.
                    'flex items-start gap-3 rounded-r-md border-l-4 py-3.5 pl-3 pr-3 text-base leading-snug transition-colors duration-150',
                    active
                      ? 'border-accent bg-nav-active font-semibold text-text-inverse'
                      : 'border-transparent text-text-inverse/75 hover:bg-nav-hover/70 hover:text-text-inverse font-medium',
                  ].join(' ')}
                >
                  <item.icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : (
        <>
        {MAIN_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            // The top-level Dashboard link duplicates Contract Management's own Dashboard
            // for a Contract-Management-only user — hide it there instead of showing two.
            if (contractManagementOnly && group.label === null && item.href === '/dashboard') return false;
            // Technical/Erection are gated on the same CONTRACTS_MANAGEMENT module as every
            // other item here — so for a Contract-Management-only user they'd otherwise
            // still pass isNavItemVisible and render under a floating "Operations" heading
            // above the flat Contract Management section below. Render them there instead,
            // right after that section, so the required top-level order still holds.
            if (contractManagementOnly && group.label === 'Operations' && (item.label === 'Technical' || item.label === 'Erection')) return false;
            return isNavItemVisible(item, user.permissions, hasAnyAdminPermission);
          });
          const showContractsHere = group.label === 'Operations' && hasAnyContractPermission && !contractManagementOnly;
          if (visibleItems.length === 0 && !showContractsHere) return null;

          return (
            <div key={group.label ?? 'main'} className="mb-1">
              {group.label && (
                <p className="px-4 mb-1 mt-3 text-[10px] font-semibold uppercase tracking-widest text-text-inverse/40">
                  {group.label}
                </p>
              )}

              {showContractsHere && (
                <div className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => setContractsExpanded((v) => !v)}
                    aria-expanded={contractsExpanded}
                    aria-controls="contracts-nav-items"
                    className={[
                      'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                      isInContracts
                        ? 'text-text-inverse font-medium'
                        : 'text-text-inverse/70 hover:bg-nav-hover hover:text-text-inverse',
                    ].join(' ')}
                  >
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">Contract Management</span>
                    {contractsExpanded ? (
                      <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  {contractsExpanded && (
                    <div id="contracts-nav-items" className="ml-3 border-l border-nav-hover">
                      {visibleContractItems.map((item) => {
                        if (!item.href) return null;
                        const active = isContractItemActive(item.href, pathname);
                        return (
                          <Link
                            key={item.label}
                            href={item.href}
                            onClick={onClose}
                            aria-current={active ? 'page' : undefined}
                            className={[
                              'flex items-center gap-2.5 pl-5 pr-4 py-1.5 text-sm transition-colors',
                              active
                                ? 'bg-nav-active text-text-inverse font-medium'
                                : 'text-text-inverse/70 hover:bg-nav-hover hover:text-text-inverse',
                            ].join(' ')}
                          >
                            <item.icon className="size-3.5 shrink-0" aria-hidden="true" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {visibleItems.map((item) => {
                if (item.comingSoon || !item.href) {
                  return (
                    <span
                      key={item.label}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-inverse/40 cursor-not-allowed select-none"
                      aria-disabled="true"
                      title="Coming soon"
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[10px] bg-nav-hover px-1.5 py-0.5 rounded text-text-inverse/50">
                        Soon
                      </span>
                    </span>
                  );
                }

                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex items-center gap-2.5 px-4 py-2 text-sm rounded-none transition-colors',
                      active
                        ? 'bg-nav-active text-text-inverse font-medium'
                        : 'text-text-inverse/70 hover:bg-nav-hover hover:text-text-inverse',
                    ].join(' ')}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}

        {/* Contract Management — flat top-level section for Contract-Management-only users (no dropdown, since it's the only module they have). Other users see it nested under Operations instead, above. */}
        {contractManagementOnly && (
          <div className="mb-1">
            <p className="px-4 mb-2 mt-3 text-sm font-bold uppercase tracking-wide text-text-inverse">
              Contract Management
            </p>
            {visibleContractItems.map((item) => {
              if (!item.href) return null;
              const active = isContractItemActive(item.href, pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                    active
                      ? 'bg-nav-active text-text-inverse font-medium'
                      : 'text-text-inverse/70 hover:bg-nav-hover hover:text-text-inverse',
                  ].join(' ')}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            {/* Technical/Erection — same CONTRACTS_MANAGEMENT gate as the items above, rendered here (not under a separate "Operations" heading) so a Contract-Management-only user still sees the required top-level order. */}
            {TECHNICAL_AND_ERECTION_ITEMS.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                    active
                      ? 'bg-nav-active text-text-inverse font-medium'
                      : 'text-text-inverse/70 hover:bg-nav-hover hover:text-text-inverse',
                  ].join(' ')}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Administration — always expanded, permission-aware (no dropdown toggle) */}
        {hasAnyAdminPermission && (
          <div className="mb-1">
            <p className="px-4 mb-2 mt-3 text-sm font-bold uppercase tracking-wide text-text-inverse">
              Administration
            </p>
            <div>
              {visibleAdminItems.map((item) => {
                if (!item.href) return null;
                const active = item.href === '/administration/dashboard'
                  ? (pathname === '/administration/dashboard' || pathname === '/administration')
                  : isActive(item.href, pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                      active
                        ? 'bg-nav-active text-text-inverse font-medium'
                        : 'text-text-inverse/70 hover:bg-nav-hover hover:text-text-inverse',
                    ].join(' ')}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        </>
        )}
      </nav>

      {/* User info footer */}
      <div className="shrink-0 px-4 py-3 border-t border-nav-hover">
        <p className="text-xs font-medium text-text-inverse truncate">{user.displayName}</p>
        <p className="text-[11px] text-text-inverse/50 truncate">{user.roleName}</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-64 shrink-0 flex-col bg-nav h-screen"
        aria-label="Application navigation"
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-nav h-screen transform transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Application navigation"
        aria-hidden={!mobileOpen}
        id="mobile-nav"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
