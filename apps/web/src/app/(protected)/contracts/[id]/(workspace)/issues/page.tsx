import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

export const metadata: Metadata = { title: 'Issue Log — Contract Management — RECAFCO FMP' };

const ISSUE_STATUS_ROWS = ['Total Issues', 'Open Issues', 'In Progress', 'Overdue Issues'];

const ISSUE_LOG_COLUMNS = ['Issue ID', 'Issue Title', 'Category', 'Priority', 'Responsible', 'Due Date', 'Status', 'Action'];

export default function ContractIssuesTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Issue Log</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track contract issues, actions and resolutions.</p>
      </div>

      {/* Issue Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Issue Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {ISSUE_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        Issue tracking will be enabled after the Issue Log backend unit.
      </p>

      {/* Issue Log table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Issue Log</h2>
          <button
            type="button"
            disabled
            title="Issue Log backend is not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Raise New Issue
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {ISSUE_LOG_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={ISSUE_LOG_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No issues tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
