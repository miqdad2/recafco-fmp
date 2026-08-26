'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import type { OrgRef, ContractPerson } from '@/lib/contracts-api';
import { AssignmentQueueFilterBar } from './assignment-queue-filter-bar';

interface Props {
  team: string | undefined;
  departmentId: string | undefined;
  ownerUserId: string | undefined;
  status: string | undefined;
  priority: string | undefined;
  dueDateMissing: boolean;
  departments: OrgRef[];
  people: ContractPerson[];
  hasActiveFilters: boolean;
}

/**
 * CM-40D — demotes the CM-40/40C filter form (now Team/Department/Contract
 * Manager/Contract Status/Priority/Due-date-missing only — Search moved to
 * the live AssignmentQueueContractPicker) behind a collapsible disclosure,
 * so the guided "Choose Contract" search is the page's primary interaction
 * rather than a register full of visible filter controls. Starts expanded
 * only if a filter from this set is already active via the URL, so a
 * manager who arrives with a filtered link can still see what's applied.
 */
export function AssignmentQueueAdvancedFilters(props: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(props.hasActiveFilters);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {expanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
        <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        Advanced filters
        {props.hasActiveFilters && (
          <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Active</span>
        )}
      </button>

      {expanded && (
        <div className="mt-3">
          <AssignmentQueueFilterBar
            team={props.team}
            departmentId={props.departmentId}
            ownerUserId={props.ownerUserId}
            status={props.status}
            priority={props.priority}
            dueDateMissing={props.dueDateMissing}
            departments={props.departments}
            people={props.people}
            hasActiveFilters={props.hasActiveFilters}
          />
        </div>
      )}
    </div>
  );
}
