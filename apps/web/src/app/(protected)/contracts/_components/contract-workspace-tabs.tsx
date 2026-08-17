'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Wallet, Factory, FileText, Paperclip, CheckCircle2, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WorkspaceTab {
  key: string;
  label: string;
  segment: string | null;
  icon?: LucideIcon;
}

const OVERVIEW_TAB: WorkspaceTab = { key: 'overview', label: 'Overview', segment: null, icon: LayoutGrid };

const SCROLLABLE_TABS: WorkspaceTab[] = [
  { key: 'payments', label: 'Payments', segment: 'payments', icon: Wallet },
  { key: 'production', label: 'Production Status', segment: 'production', icon: Factory },
  { key: 'variations', label: 'Variations', segment: 'variations' },
  { key: 'claims', label: 'Claims Registry', segment: 'claims' },
  { key: 'risks', label: 'Risk Assessment', segment: 'risks' },
  { key: 'documents', label: 'Documents & Obligations', segment: 'documents', icon: FileText },
  { key: 'workflow', label: 'Workflow & Team Tasks', segment: 'workflow' },
  { key: 'issues', label: 'Issue Log', segment: 'issues' },
  { key: 'attachments', label: 'Attachments', segment: 'attachments', icon: Paperclip },
  { key: 'closeout', label: 'Closeout', segment: 'closeout', icon: CheckCircle2 },
  { key: 'activity', label: 'Activity / Audit History', segment: 'activity', icon: History },
];

interface Props {
  contractId: string;
}

export function ContractWorkspaceTabs({ contractId }: Props): React.JSX.Element {
  const pathname = usePathname();
  const base = `/contracts/${contractId}`;
  const scrollRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function updateFades(): void {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }

    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);
    return () => {
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, []);

  // Keep the active scrollable tab fully visible — never let it sit clipped under the edge fade.
  // Instant (not smooth) so there's no mid-animation frame where the fade overlay can render on top of it.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'auto', inline: 'nearest', block: 'nearest' });
  }, [pathname]);

  function tabClassName(active: boolean): string {
    return [
      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-focus',
      active
        ? 'bg-accent text-white shadow-sm'
        : 'text-text-secondary hover:bg-surface hover:text-text-primary',
    ].join(' ');
  }

  const overviewActive = pathname === base;
  const OverviewIcon = OVERVIEW_TAB.icon;

  return (
    <div className="-mx-6 lg:-mx-8 px-6 lg:px-8">
      <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1">
        {/* Overview stays pinned so it's never scrolled out of view. */}
        <Link
          href={base}
          aria-current={overviewActive ? 'page' : undefined}
          className={tabClassName(overviewActive)}
        >
          {OverviewIcon && <OverviewIcon className="size-3.5 shrink-0" aria-hidden="true" />}
          {OVERVIEW_TAB.label}
        </Link>

        <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />

        <div className="relative min-w-0 flex-1">
          <nav
            ref={scrollRef}
            aria-label="Contract workspace sections"
            className="flex items-center gap-1 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {SCROLLABLE_TABS.map((tab) => {
              const href = `${base}/${tab.segment}`;
              const active = pathname === href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.key}
                  ref={active ? activeRef : undefined}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={tabClassName(active)}
                >
                  {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {canScrollLeft && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-surface-secondary to-transparent"
            />
          )}
          {canScrollRight && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-surface-secondary to-transparent"
            />
          )}
        </div>
      </div>
    </div>
  );
}
