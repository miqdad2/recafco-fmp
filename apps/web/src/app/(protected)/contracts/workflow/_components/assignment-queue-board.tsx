'use client';

import { useState } from 'react';
import type { ContractPerson, WorkflowAssignmentQueueItem, ContractWorkflowTeam } from '@/lib/contracts-api';
import { AssignmentQueueTaskCard } from './assignment-queue-task-card';
import { AssignTaskModal } from './assign-task-modal';

interface Props {
  items: WorkflowAssignmentQueueItem[];
  people: ContractPerson[];
  truncated: boolean;
  /** CM-40C — forwarded to each AssignmentQueueTaskCard; set when the board is already scoped to one contract (its own header shows that context once). Defaults to false. */
  hideContractInfo?: boolean;
}

const TEAM_COLUMNS: { team: ContractWorkflowTeam; label: string }[] = [
  { team: 'TECHNICAL', label: 'Technical' },
  { team: 'PRODUCTION', label: 'Production' },
  { team: 'ERECTION', label: 'Erection' },
  { team: 'QS_COMMERCIAL', label: 'QS / Commercial' },
];

// Subtle team accent styling. Technical/Erection/QS-Commercial reuse the
// existing info/warning/success semantic tokens (already blue/orange/green);
// Production uses the new --color-team-production token added in CM-40B —
// see globals.css. Never raw Tailwind palette colors, per ui-tokens.md.
const TEAM_STYLES: Record<ContractWorkflowTeam, { headerBg: string; headerText: string; cardBorder: string }> = {
  TECHNICAL: { headerBg: 'bg-info-light', headerText: 'text-info', cardBorder: 'border-t-info' },
  PRODUCTION: { headerBg: 'bg-team-production-light', headerText: 'text-team-production', cardBorder: 'border-t-team-production' },
  ERECTION: { headerBg: 'bg-warning-light', headerText: 'text-warning', cardBorder: 'border-t-warning' },
  QS_COMMERCIAL: { headerBg: 'bg-success-light', headerText: 'text-success', cardBorder: 'border-t-success' },
};

/**
 * CM-40B — Kanban view of the Assignment Queue: the same `items` the table
 * view renders, grouped into 4 team columns instead of rows. Assigning opens
 * the identical AssignTaskModal from CM-40 (same component, same
 * updateWorkflowTaskAction submit path) — router.refresh() on success
 * re-fetches the parent server data, so an assigned task drops out of
 * whichever view is active and the summary cards above update, exactly as
 * the table view already behaves.
 */
export function AssignmentQueueBoard({ items, people, truncated, hideContractInfo = false }: Props): React.JSX.Element {
  const [openItem, setOpenItem] = useState<WorkflowAssignmentQueueItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">All generated workflow tasks are assigned.</p>
        <p className="text-xs text-text-muted mt-1">Use the workflow board to monitor progress.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TEAM_COLUMNS.map(({ team, label }) => {
          const teamItems = items.filter((i) => i.team === team);
          const style = TEAM_STYLES[team];
          return (
            <div key={team} className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col min-w-0">
              <div className={`flex items-center justify-between px-3 py-2 ${style.headerBg}`}>
                <span className={`text-xs font-semibold ${style.headerText}`}>{label}</span>
                <span className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-semibold ${style.headerText}`}>
                  {teamItems.length}
                </span>
              </div>
              <div className="p-2.5 space-y-2.5 flex-1">
                {teamItems.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-6">No unassigned tasks for this team.</p>
                ) : (
                  teamItems.map((item) => (
                    <AssignmentQueueTaskCard
                      key={item.taskId}
                      item={item}
                      accentBorderCls={style.cardBorder}
                      onAssign={() => setOpenItem(item)}
                      hideContractInfo={hideContractInfo}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {truncated && (
        <p className="mt-3 text-[11px] text-text-muted">
          Showing the first {items.length} unassigned tasks. Narrow the filters above to see more specific results.
        </p>
      )}

      {openItem && (
        <AssignTaskModal
          item={openItem}
          people={people}
          onClose={() => setOpenItem(null)}
          onAssigned={() => setOpenItem(null)}
        />
      )}
    </>
  );
}
