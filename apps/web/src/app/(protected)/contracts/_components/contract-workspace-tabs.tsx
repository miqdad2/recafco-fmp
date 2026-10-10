'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Wallet,
  Factory,
  FileText,
  Paperclip,
  CheckCircle2,
  History,
  CalendarDays,
  ListChecks,
  MessageSquareWarning,
  GitBranch,
  HandCoins,
  ShieldAlert,
  Boxes,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WORKSPACE_TABS, isWorkspaceTabActive, workspaceTabHref } from '../_lib/contract-workspace-tabs';

const TAB_ICONS: Record<string, LucideIcon> = {
  overview: LayoutGrid,
  schedule: CalendarDays,
  payments: Wallet,
  production: Factory,
  'boq-progress': Boxes,
  variations: GitBranch,
  claims: HandCoins,
  risks: ShieldAlert,
  documents: FileText,
  workflow: ListChecks,
  issues: MessageSquareWarning,
  attachments: Paperclip,
  activity: History,
  closeout: CheckCircle2,
};

interface Props {
  contractId: string;
}

/**
 * Contract workspace tab bar. CM-66C removed the "More" dropdown so no tab is
 * ever hidden — that still holds. FMP-CONTRACT-09B: a single simple row of
 * the same 14 tabs in the original order (no group labels or dividers) inside
 * one soft container. Desktop: tabs wrap cleanly onto a second row if needed.
 * Small screens: one horizontally scrollable row (scrolling stays inside this
 * container, never the page) with the active tab scrolled into view.
 */
export function ContractWorkspaceTabs({ contractId }: Props): React.JSX.Element {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Keep the active tab visible when the row is scrolled (small screens).
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  function tabClassName(active: boolean): string {
    return [
      'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-focus',
      active
        ? 'bg-accent font-semibold text-white shadow-sm'
        : 'font-medium text-text-secondary hover:bg-surface hover:text-text-primary',
    ].join(' ');
  }

  return (
    <div className="-mx-6 lg:-mx-8 px-6 lg:px-8">
      <nav
        aria-label="Contract workspace sections"
        className="flex max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-surface-secondary p-1.5 lg:flex-wrap lg:overflow-x-visible"
      >
        {WORKSPACE_TABS.map((tab) => {
          const href = workspaceTabHref(contractId, tab);
          const active = isWorkspaceTabActive(pathname, href, tab);
          const Icon = TAB_ICONS[tab.key];
          return (
            <Link
              key={tab.key}
              href={href}
              ref={active ? activeRef : undefined}
              aria-current={active ? 'page' : undefined}
              className={tabClassName(active)}
            >
              {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
