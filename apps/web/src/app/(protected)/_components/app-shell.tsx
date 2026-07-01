'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';

export interface ShellUser {
  displayName: string;
  username: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}

      <Sidebar user={user} mobileOpen={mobileOpen} onClose={closeMenu} pathname={pathname} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopHeader user={user} onMenuOpen={openMenu} />
        <main id="main-content" className="flex-1 overflow-auto bg-background" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
