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
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import type { ShellUser } from './app-shell';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string | null;
  icon: LucideIcon;
  comingSoon?: boolean;
  permission?: string;
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
      { label: 'Factory Tasks Management', href: '/factory-tasks', icon: ClipboardList },
      { label: 'Incident Report', href: '/incidents', icon: AlertTriangle },
      { label: 'Maintenance Requests', href: '/maintenance', icon: Wrench },
      { label: 'Safety & Compliance', href: '/safety-compliance', icon: ShieldCheck },
      { label: 'Contracts Management', href: '/contracts', icon: FileText },
      { label: 'Production Dashboard', href: '/production', icon: Factory },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Audit Log', href: null, icon: FileSearch, comingSoon: true },
    ],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/administration', icon: Settings },
  { label: 'Users', href: '/administration/users', icon: Users, permission: 'users.read' },
  { label: 'Roles', href: '/administration/roles', icon: Shield, permission: 'roles.read' },
  { label: 'Departments', href: '/administration/departments', icon: Building2, permission: 'org.departments.read' },
  { label: 'Plants', href: '/administration/plants', icon: Factory, permission: 'org.plants.read' },
  { label: 'Locations', href: '/administration/locations', icon: MapPin, permission: 'org.locations.read' },
];

interface SidebarProps {
  user: ShellUser;
  mobileOpen: boolean;
  onClose: () => void;
  pathname: string;
}

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({ user, mobileOpen, onClose, pathname }: SidebarProps): React.JSX.Element {
  const isInAdmin = pathname.startsWith('/administration');
  const [adminExpanded, setAdminExpanded] = useState(isInAdmin);

  // Re-expand when navigating into admin
  useEffect(() => {
    if (isInAdmin) setAdminExpanded(true);
  }, [isInAdmin]);

  const hasAnyAdminPermission = ADMIN_ITEMS.some(
    (item) => !item.permission || user.permissions.includes(item.permission),
  );

  const visibleAdminItems = ADMIN_ITEMS.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  );

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
        {MAIN_GROUPS.map((group) => (
          <div key={group.label ?? 'main'} className="mb-1">
            {group.label && (
              <p className="px-4 mb-1 mt-3 text-[10px] font-semibold uppercase tracking-widest text-text-inverse/40">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
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
        ))}

        {/* Administration — expandable, permission-aware */}
        {hasAnyAdminPermission && (
          <div className="mb-1">
            <p className="px-4 mb-1 mt-3 text-[10px] font-semibold uppercase tracking-widest text-text-inverse/40">
              Administration
            </p>
            <button
              type="button"
              onClick={() => setAdminExpanded((v) => !v)}
              aria-expanded={adminExpanded}
              aria-controls="admin-nav-items"
              className={[
                'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                isInAdmin
                  ? 'text-text-inverse font-medium'
                  : 'text-text-inverse/70 hover:bg-nav-hover hover:text-text-inverse',
              ].join(' ')}
            >
              <Settings className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">Administration</span>
              {adminExpanded ? (
                <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
              )}
            </button>

            {adminExpanded && (
              <div id="admin-nav-items" className="ml-3 border-l border-nav-hover">
                {visibleAdminItems.map((item) => {
                  if (!item.href) return null;
                  const active = item.href === '/administration'
                    ? pathname === '/administration'
                    : isActive(item.href, pathname);
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
