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
  Wallet,
  AlertCircle,
  Receipt,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import type { ShellUser } from './app-shell';
import type { LucideIcon } from 'lucide-react';
import { canSeeModule, isContractManagementOnlyAccess, isContractStaffOnlyAccess } from '../_lib/module-visibility';
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

const MAIN_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Factory Tasks Management', href: '/factory-tasks/dashboard', icon: ClipboardList, module: 'FACTORY_TASKS' },
      { label: 'Incident Report', href: '/incidents/dashboard', icon: AlertTriangle, module: 'INCIDENT_REPORT' },
      { label: 'Maintenance Requests', href: '/maintenance/dashboard', icon: Wrench, module: 'MAINTENANCE_REQUESTS' },
      { label: 'Safety & Compliance', href: '/safety-compliance/dashboard', icon: ShieldCheck, module: 'SAFETY_COMPLIANCE' },
      { label: 'Production Dashboard', href: '/production/dashboard', icon: Factory, module: 'PRODUCTION_DASHBOARD' },
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
 */
const CONTRACT_STAFF_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/contracts/dashboard', icon: LayoutDashboard, module: 'CONTRACTS_MANAGEMENT' },
  { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks', icon: Workflow, module: 'CONTRACTS_MANAGEMENT' },
];

/** Fixed module-level slugs directly under /contracts — anything else (an id, /new, /schedule sub-routes, etc.) belongs to Contract List's active state, not a sibling summary page. */
const CONTRACT_TOP_LEVEL_SLUGS = ['dashboard', 'schedule', 'workflow', 'payments', 'issues', 'claims', 'closeouts'];

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
  if (href === '/') return pathname === '/';
  if (href.endsWith('/dashboard')) {
    const base = href.slice(0, -'/dashboard'.length);
    return pathname === href || pathname === base || pathname.startsWith(base + '/');
  }
  return pathname === href || pathname.startsWith(href + '/');
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

  const visibleContractItems = contractItemsSource.filter(
    (item) => isNavItemVisible(item, user.permissions, hasAnyAdminPermission),
  );

  // A user who can only see Contract Management gets a flattened, dropdown-free sidebar:
  // no duplicate top-level Dashboard link, and Contract Management becomes its own
  // top-level section instead of a nested group under Operations.
  const contractManagementOnly = isContractManagementOnlyAccess(user.permissions);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="flex items-center justify-between h-14 px-4 shrink-0 border-b border-nav-hover">
        <Link
          href="/"
          className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
          onClick={onClose}
        >
          <span className="flex items-center justify-center size-7 rounded bg-accent text-white text-xs font-bold shrink-0">
            R
          </span>
          <span className="text-sm font-semibold text-text-inverse tracking-tight">
            RECAFCO FMP
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
        {MAIN_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            // The top-level Dashboard link duplicates Contract Management's own Dashboard
            // for a Contract-Management-only user — hide it there instead of showing two.
            if (contractManagementOnly && group.label === null && item.href === '/') return false;
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
