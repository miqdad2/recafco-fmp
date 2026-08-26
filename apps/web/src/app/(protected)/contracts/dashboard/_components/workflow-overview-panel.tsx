import Link from 'next/link';
import type { TeamWorkflowOverview, WorkflowTeam } from '@/lib/contracts-api';

interface Props {
  overview: TeamWorkflowOverview[];
}

const TEAM_LABELS: Record<WorkflowTeam, string> = {
  TECHNICAL: 'Technical',
  PRODUCTION: 'Production',
  ERECTION: 'Erection',
  QS_COMMERCIAL: 'QS / Commercial',
};

/** CM-39C — renamed the "View" link to "View team tasks" and gave
 * Unassigned/Overdue a small colored dot so a manager can spot the teams
 * that need attention without reading every number. Same 4 stats, same data. */
export function WorkflowOverviewPanel({ overview }: Props): React.JSX.Element {
  const totalOpen = overview.reduce((sum, o) => sum + o.openTasks, 0);

  if (totalOpen === 0 && overview.every((o) => o.completedTasks === 0)) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">No team workload to show yet.</p>
        <p className="text-xs text-text-muted mt-1">Tasks generate automatically once a contract is activated.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {overview.map((team) => (
        <div key={team.team} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{TEAM_LABELS[team.team]}</h3>
            <Link href={`/contracts/workflow?team=${team.team}`} className="text-xs text-accent hover:underline whitespace-nowrap">
              View team tasks
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <div>
              <dt className="text-text-muted">Open</dt>
              <dd className="font-medium text-text-primary">{team.openTasks}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Unassigned</dt>
              <dd className={`inline-flex items-center gap-1 font-medium ${team.unassignedTasks > 0 ? 'text-warning' : 'text-text-primary'}`}>
                {team.unassignedTasks > 0 && <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />}
                {team.unassignedTasks}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Overdue</dt>
              <dd className={`inline-flex items-center gap-1 font-medium ${team.overdueTasks > 0 ? 'text-danger' : 'text-text-primary'}`}>
                {team.overdueTasks > 0 && <span className="size-1.5 rounded-full bg-danger" aria-hidden="true" />}
                {team.overdueTasks}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Completed</dt>
              <dd className="font-medium text-text-primary">{team.completedTasks}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}
