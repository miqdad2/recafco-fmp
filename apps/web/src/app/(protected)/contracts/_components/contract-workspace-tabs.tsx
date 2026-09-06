'use client';

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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WorkspaceTab {
  key: string;
  label: string;
  segment: string | null;
  icon: LucideIcon;
}

// CM-66C — reverted the CM-66B "primary row + More dropdown" split: with 13
// tabs, a hidden-behind-a-dropdown group made Activity/Attachments/Claims/
// Risk/Variations harder to find, not easier. Every tab is shown directly,
// full name, and the row wraps onto a second line instead of scrolling or
// clipping — no tab is ever hidden behind another control.
const WORKSPACE_TABS: WorkspaceTab[] = [
  { key: 'overview', label: 'Overview', segment: null, icon: LayoutGrid },
  { key: 'schedule', label: 'Schedule', segment: 'schedule', icon: CalendarDays },
  { key: 'payments', label: 'Payments', segment: 'payments', icon: Wallet },
  { key: 'production', label: 'Production Status', segment: 'production', icon: Factory },
  { key: 'variations', label: 'Variations / Change Orders', segment: 'variations', icon: GitBranch },
  { key: 'claims', label: 'Claims', segment: 'claims', icon: HandCoins },
  { key: 'risks', label: 'Risk Assessment', segment: 'risks', icon: ShieldAlert },
  { key: 'documents', label: 'Documents & Obligations', segment: 'documents', icon: FileText },
  { key: 'workflow', label: 'Workflow & Team Tasks', segment: 'workflow', icon: ListChecks },
  { key: 'issues', label: 'Issue Log', segment: 'issues', icon: MessageSquareWarning },
  { key: 'attachments', label: 'Attachments', segment: 'attachments', icon: Paperclip },
  { key: 'activity', label: 'Activity / Audit History', segment: 'activity', icon: History },
  { key: 'closeout', label: 'Closeout', segment: 'closeout', icon: CheckCircle2 },
];

interface Props {
  contractId: string;
}

export function ContractWorkspaceTabs({ contractId }: Props): React.JSX.Element {
  const pathname = usePathname();
  const base = `/contracts/${contractId}`;

  function hrefFor(tab: WorkspaceTab): string {
    return tab.segment ? `${base}/${tab.segment}` : base;
  }

  function tabClassName(active: boolean): string {
    return [
      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-focus',
      active
        ? 'bg-accent text-white shadow-sm'
        : 'text-text-secondary hover:bg-surface hover:text-text-primary',
    ].join(' ');
  }

  return (
    <div className="-mx-6 lg:-mx-8 px-6 lg:px-8">
      <nav
        aria-label="Contract workspace sections"
        className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-secondary p-1"
      >
        {WORKSPACE_TABS.map((tab) => {
          const href = hrefFor(tab);
          const active = pathname === href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={tabClassName(active)}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
