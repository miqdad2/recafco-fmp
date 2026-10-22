'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Factory,
  Ruler,
  Warehouse,
  HardHat,
  FileText,
  Paperclip,
  CheckCircle2,
  History,
  MessageSquareWarning,
  GitBranch,
  HandCoins,
  ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WORKSPACE_TABS, isWorkspaceTabActive, workspaceTabHref } from '../_lib/contract-workspace-tabs';

const TAB_ICONS: Record<string, LucideIcon> = {
  overview: LayoutGrid,
  technical: Ruler,
  'production-planning': Factory,
  delivery: Warehouse,
  erection: HardHat,
  variations: GitBranch,
  claims: HandCoins,
  risks: ShieldAlert,
  documents: FileText,
  issues: MessageSquareWarning,
  attachments: Paperclip,
  activity: History,
  closeout: CheckCircle2,
};

interface Props {
  contractId: string;
}

/**
 * Contract workspace tab bar. FMP-CONTRACT-DETAIL-01: a single flat row of the 13
 * department-ordered tabs (no group labels or dividers) inside one soft container.
 * Tabs wrap onto extra rows at every width, so the page never scrolls sideways.
 */
export function ContractWorkspaceTabs({ contractId }: Props): React.JSX.Element {
  const pathname = usePathname();

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
        className="flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-surface-secondary p-1.5"
      >
        {WORKSPACE_TABS.map((tab) => {
          const href = workspaceTabHref(contractId, tab);
          const active = isWorkspaceTabActive(pathname, href, tab);
          const Icon = TAB_ICONS[tab.key];
          return (
            <Link
              key={tab.key}
              href={href}
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
