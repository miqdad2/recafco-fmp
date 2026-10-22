'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from 'lucide-react';
import { logoutAction } from '../../../(protected)/actions';
import { MANAGEMENT_BASE_PATH, MANAGEMENT_MODULES, moduleHref } from '../_lib/management-modules';

interface ManagementShellProps {
  displayName: string;
  roleName: string;
  children: React.ReactNode;
}

function avatarInitial(name: string): string {
  return name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?';
}

interface NavListProps {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}

function NavList({ collapsed, pathname, onNavigate }: NavListProps): React.JSX.Element {
  return (
    <nav aria-label="Management Intelligence modules">
      <ul className="space-y-1">
        {MANAGEMENT_MODULES.map((m) => {
          const href = moduleHref(m);
          // The home page (/management/intelligence) is the Executive Overview hub.
          const active = pathname === href || (m.slug === 'executive-overview' && pathname === MANAGEMENT_BASE_PATH);
          const Icon = m.icon;
          return (
            <li key={m.slug}>
              <Link
                href={href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? m.title : undefined}
                className={`flex h-11 items-center gap-3 rounded-lg text-[15px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  active ? 'bg-nav-active text-text-inverse' : 'text-slate-300 hover:bg-nav-hover hover:text-text-inverse'
                } ${collapsed ? 'justify-center' : 'px-3'}`}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className={collapsed ? 'sr-only' : 'truncate'}>{m.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ManagementShell({ displayName, roleName, children }: ManagementShellProps): React.JSX.Element {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobile = useCallback((): void => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  return (
    <div className="flex h-dvh flex-col overflow-clip bg-background">
      <a
        href="#management-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text-primary"
      >
        Skip to content
      </a>

      <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="management-mobile-nav"
            className="rounded-md p-2 text-text-secondary hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link
            href={MANAGEMENT_BASE_PATH}
            className="flex min-w-0 items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Image src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} priority className="h-9 w-auto shrink-0" />
            <span className="truncate text-base font-bold tracking-tight text-text-primary sm:text-lg">
              Management Intelligence Center
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-secondary text-sm font-bold uppercase text-text-primary"
            >
              {avatarInitial(displayName)}
            </span>
            <div className="hidden min-w-0 max-w-48 sm:block">
              <p className="truncate text-sm font-semibold leading-tight text-text-primary">{displayName}</p>
              <p className="truncate text-[13px] leading-tight text-text-secondary">{roleName}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-accent/30 bg-accent-light px-3 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:px-4"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={`hidden shrink-0 flex-col bg-nav py-4 transition-[width] duration-200 md:flex ${collapsed ? 'w-[72px] px-2' : 'w-64 px-3'}`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NavList collapsed={collapsed} pathname={pathname} />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mt-3 flex h-10 items-center gap-3 rounded-lg text-sm text-slate-300 hover:bg-nav-hover hover:text-text-inverse focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${collapsed ? 'justify-center' : 'px-3'}`}
          >
            {collapsed ? <ChevronsRight className="size-5" aria-hidden="true" /> : <ChevronsLeft className="size-5" aria-hidden="true" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" aria-hidden="true" onClick={closeMobile} />}
        <aside
          id="management-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          hidden={!mobileOpen}
          className="fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-nav p-3 md:hidden"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-text-inverse">Management Intelligence</span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMobile}
              aria-label="Close navigation menu"
              className="rounded-md p-2 text-slate-300 hover:bg-nav-hover hover:text-text-inverse focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NavList collapsed={false} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </aside>

        <main
          id="management-content"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
