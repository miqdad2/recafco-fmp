'use client';

import { useState } from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import type { ContractPerson, WorkflowAssignmentQueueItem } from '@/lib/contracts-api';
import { AssignmentQueueBoard } from './assignment-queue-board';
import { AssignmentQueueTable } from './assignment-queue-table';

interface Props {
  items: WorkflowAssignmentQueueItem[];
  people: ContractPerson[];
  truncated: boolean;
  /** CM-40C — forwarded to AssignmentQueueBoard when scoped to a single contract. Defaults to false. */
  hideContractInfo?: boolean;
}

type ViewMode = 'board' | 'table';

const TOGGLE_BASE = 'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * CM-40B — client-side toggle between the Kanban Board View (new default)
 * and the existing Table View from CM-40. Both views render off the SAME
 * server-fetched `items`/`people`/`truncated` props — switching views never
 * refetches or loses filter state, it only changes which already-rendered
 * layout is visible, matching the established toggle pattern from CM-39's
 * ManagerSecondaryTabs.
 */
export function AssignmentQueueViewSwitcher({ items, people, truncated, hideContractInfo = false }: Props): React.JSX.Element {
  const [view, setView] = useState<ViewMode>('board');

  return (
    <div className="space-y-3">
      <div className="ml-auto flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setView('board')}
          aria-pressed={view === 'board'}
          className={`${TOGGLE_BASE} ${view === 'board' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          Board View
        </button>
        <button
          type="button"
          onClick={() => setView('table')}
          aria-pressed={view === 'table'}
          className={`${TOGGLE_BASE} ${view === 'table' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          <Table2 className="size-3.5" aria-hidden="true" />
          Table View
        </button>
      </div>

      {view === 'board' ? (
        <AssignmentQueueBoard items={items} people={people} truncated={truncated} hideContractInfo={hideContractInfo} />
      ) : (
        <AssignmentQueueTable items={items} people={people} truncated={truncated} />
      )}
    </div>
  );
}
