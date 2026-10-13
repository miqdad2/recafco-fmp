'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';
import { FULL_PLATFORM_READ_ONLY_MESSAGE, shouldShowReadOnlyBanner } from '../_lib/access-mode';

export interface ShellUser {
  displayName: string;
  username: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  /** FMP-ACCESS-01 — explicit Full Platform Access (main sidebar + Control Center landing). */
  fullPlatformAccess?: boolean;
}

interface AppShellProps {
  user: ShellUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape key to close
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        lastFocusRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  // FMP-UI-44B — inside the protected shell the browser window itself must never be the scroller:
  // only <main> scrolls. Applied to <html> while the shell is mounted and removed on leaving
  // (login and other pages outside the shell keep normal page scrolling).
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  // Prevent background scroll when mobile nav is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const openMenu = useCallback((trigger: HTMLElement): void => {
    lastFocusRef.current = trigger;
    setMobileOpen(true);
  }, []);

  const closeMenu = useCallback((): void => {
    setMobileOpen(false);
    lastFocusRef.current?.focus();
  }, []);

  // FMP-UI-44 / 44B — the shell is exactly one viewport tall and never scrolls itself: the sidebar
  // and header stay put and only <main> scrolls.
  //  - `overflow-clip` (not `overflow-hidden`): a hidden-overflow box can still be scrolled by the
  //    browser (focusing an invalid field, scrollIntoView, an anchor jump); a clipped one cannot.
  //  - `relative` on the shell AND on <main> is what actually stopped the page scrolling on New
  //    Contract Register: a position:absolute child with no positioned ancestor (the visually hidden
  //    file inputs, `sr-only`) is placed against the whole page, so `overflow-clip` on the shell
  //    could not clip it and it made the document taller than the window. With <main> as the
  //    containing block it scrolls inside <main> instead.
  //  - `h-dvh` follows the visible height on phones/tablets, where 100vh is taller than the screen.
  return (
    <div className="relative flex h-dvh overflow-clip">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}

      <Sidebar user={user} mobileOpen={mobileOpen} onClose={closeMenu} pathname={pathname} />

      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-clip">
        <TopHeader user={user} onMenuOpen={openMenu} />
        <main id="main-content" className="relative flex-1 min-h-0 overflow-auto overscroll-contain bg-background" tabIndex={-1}>
          {shouldShowReadOnlyBanner(pathname, user.permissions, user.fullPlatformAccess === true) && (
            <p role="status" className="mx-6 mt-4 rounded-md border border-info/20 bg-info-light px-3 py-2 text-xs text-info">
              {FULL_PLATFORM_READ_ONLY_MESSAGE}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
