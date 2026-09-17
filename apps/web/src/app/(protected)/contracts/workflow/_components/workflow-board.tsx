'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ContractWorkflowTask, ContractWorkflowTeam, ContractPerson } from '@/lib/contracts-api';
import { WorkflowTaskCard } from './workflow-task-card';
import { WorkflowTaskDrawer } from './workflow-task-drawer';

interface Props {
  contractId: string;
  tasks: ContractWorkflowTask[];
  people: ContractPerson[];
  /** Has contracts.update — full manager access to every task in scope, all fields. */
  canManage: boolean;
  /** Has contracts.workflow_update — may edit only tasks assigned to currentUserId, and only the staff-allowed field subset. */
  canUpdateAssigned: boolean;
  currentUserId: string | null;
  /** Text shown in the empty state when the caller has already applied a "My Tasks only" filter server-side. */
  emptyMessage?: string;
  /** CM-53 — real contract identity for the task drawer's "Task Summary" section, when the caller already has it (e.g. from ContractWorkflowDetail.contract). Omitted where not readily available — never fabricated. */
  contractReference?: string;
  contractTitle?: string;
}

const TEAM_LANES: { team: ContractWorkflowTeam; label: string }[] = [
  { team: 'TECHNICAL', label: 'Technical Team' },
  { team: 'PRODUCTION', label: 'Production Team' },
  { team: 'ERECTION', label: 'Erection Team' },
  { team: 'QS_COMMERCIAL', label: 'QS / Commercial Team' },
];

export function WorkflowBoard({
  contractId,
  tasks,
  people,
  canManage,
  canUpdateAssigned,
  currentUserId,
  emptyMessage,
  contractReference,
  contractTitle,
}: Props): React.JSX.Element {
  // Stores only the id, not a snapshot — so if `tasks` refreshes (e.g. after
  // the drawer's own save/comment/attachment actions call router.refresh()),
  // the open drawer re-derives from the fresh task data instead of showing
  // stale field values while it stays open.
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const openTask = openTaskId ? (tasks.find((t) => t.id === openTaskId) ?? null) : null;

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">{emptyMessage ?? 'No workflow tasks configured.'}</p>
        {!emptyMessage && (
          <p className="text-xs text-text-muted mt-1">
            This contract&rsquo;s saved scope of work doesn&rsquo;t call for any default workflow tasks yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
        {TEAM_LANES.map((lane) => {
          const laneTasks = tasks.filter((t) => t.team === lane.team);
          if (laneTasks.length === 0) return null;
          return (
            <div key={lane.team} className="rounded-lg border border-border bg-surface p-3 min-w-0">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 px-1">{lane.label}</h3>
              {/* CM-71H.1 — these are individual task cards (the generic team-task
                  register); the Erection Team lane also links back to the dedicated,
                  guided 7-step Erection Workflow (CM-71A-H) so this board is never
                  mistaken for the only way to manage erection work. */}
              {lane.team === 'ERECTION' && (
                <Link
                  href={`/contracts/${contractId}/workflow`}
                  className="mb-2 flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/10"
                >
                  Open Guided Erection Workflow
                  <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                </Link>
              )}
              <div className="space-y-2">
                {laneTasks.map((task) => (
                  <WorkflowTaskCard key={task.id} task={task} onOpen={(t) => setOpenTaskId(t.id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {openTask && (
        <WorkflowTaskDrawer
          task={openTask}
          contractId={contractId}
          people={people}
          canManage={canManage}
          canEdit={canManage || (canUpdateAssigned && openTask.responsibleUserId === currentUserId)}
          onClose={() => setOpenTaskId(null)}
          {...(contractReference ? { contractReference } : {})}
          {...(contractTitle ? { contractTitle } : {})}
        />
      )}
    </div>
  );
}
