'use client';

import { useState } from 'react';

type TabKey = 'workflow' | 'upcoming' | 'recent';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'workflow', label: 'Team Workload' },
  { key: 'upcoming', label: 'Upcoming Deadlines' },
  { key: 'recent', label: 'Recent Updates' },
];

interface Props {
  workflowLoad: React.ReactNode;
  upcoming: React.ReactNode;
  recent: React.ReactNode;
}

/** CM-39 — replaces CM-37's three always-visible stacked sections (Workflow
 * Assignment Overview / Upcoming Schedule / Recently Updated Contracts) with
 * a single tab strip so only one is shown at a time. Data fetching stays
 * entirely server-side in page.tsx — this client component only toggles
 * which already-rendered panel is visible, it never fetches anything itself. */
export function ManagerSecondaryTabs({ workflowLoad, upcoming, recent }: Props): React.JSX.Element {
  const [active, setActive] = useState<TabKey>('workflow');
  const panels: Record<TabKey, React.ReactNode> = { workflow: workflowLoad, upcoming, recent };

  return (
    <div>
      <div role="tablist" aria-label="Manager dashboard secondary views" className="flex items-center gap-1 border-b border-border mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={[
              'px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              active === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{panels[active]}</div>
    </div>
  );
}
