import type { Metadata } from 'next';
import { ListTodo } from 'lucide-react';

export const metadata: Metadata = { title: 'Workflow & Team Tasks — Contract Management — RECAFCO FMP' };

const WORKFLOW_STATUS_ROWS = ['Current Stage', 'Current Team', 'Next Action', 'Overall Status'];

const TEAM_LANES: { team: string; steps: string[] }[] = [
  {
    team: 'Technical Team',
    steps: ['Drawing Received', 'SD & Calculation Submission', 'Getting Approval', 'FD Issuance'],
  },
  {
    team: 'Production Team',
    steps: [
      'Submission of Mix Design', 'Mix Design Approval', 'Mould Preparation',
      'Issue Production Schedule', 'Production Start',
    ],
  },
  {
    team: 'Erection Team',
    steps: [
      'Issued of Erection Method Statement', 'Erection Statement Approval', 'Issued Erection Schedule',
      'Delivery Start', 'Erection Start', 'Issue Checklist',
    ],
  },
  {
    team: 'QS / Commercial Team',
    steps: ['Payment Issued'],
  },
];

const TASK_REGISTER_COLUMNS = ['Team', 'Task / Step Name', 'Status', 'Responsible', 'Due Date', 'Action'];

export default function ContractWorkflowTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Workflow & Team Tasks</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track contract workflow progress, team responsibilities and pending tasks.</p>
      </div>

      {/* Workflow Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Workflow Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {WORKFLOW_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Workflow Progress Board */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Workflow Progress Board</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {TEAM_LANES.map((lane) => (
            <div key={lane.team} className="rounded-lg border border-border bg-surface p-3">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 px-1">{lane.team}</h3>
              <div className="space-y-1.5">
                {lane.steps.map((step) => (
                  <div
                    key={step}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ListTodo className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                      <span className="text-xs font-medium text-text-primary truncate">{step}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-text-muted border border-border">
                      Not tracked yet
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team Task Register */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Team Task Register</h2>
          <button
            type="button"
            disabled
            title="Workflow backend is not implemented yet."
            className="rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            Update Task Status
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {TASK_REGISTER_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={TASK_REGISTER_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No workflow tasks tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
