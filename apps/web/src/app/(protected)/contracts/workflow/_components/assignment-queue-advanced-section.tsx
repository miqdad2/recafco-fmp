'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ContractPerson, WorkflowAssignmentQueueItem } from '@/lib/contracts-api';
import { AssignmentQueueViewSwitcher } from './assignment-queue-view-switcher';

interface Props {
  items: WorkflowAssignmentQueueItem[];
  people: ContractPerson[];
  truncated: boolean;
}

/**
 * CM-40C — the CM-40B all-contracts Board/Table view, demoted from the
 * default landing content to an opt-in "Advanced" section below the
 * contract-first cards. Collapsed by default (never the default view, per
 * spec) so a manager who prefers the old flat multi-contract list can still
 * reach it without it competing with the new contract-first flow.
 */
export function AssignmentQueueAdvancedSection({ items, people, truncated }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {expanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
        {expanded ? 'Hide' : 'Show'} All Unassigned Tasks (Advanced)
      </button>

      {expanded && (
        <div className="mt-3">
          <AssignmentQueueViewSwitcher items={items} people={people} truncated={truncated} />
        </div>
      )}
    </div>
  );
}
