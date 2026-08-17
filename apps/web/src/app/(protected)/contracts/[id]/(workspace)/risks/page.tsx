import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

export const metadata: Metadata = { title: 'Risk Assessment — Contract Management — RECAFCO FMP' };

const RISK_STATUS_ROWS = ['Total Risks', 'High / Critical Risks', 'Open Risks', 'Mitigated Risks'];

const RISK_COLUMNS = ['Risk ID', 'Risk Description', 'Risk Level', 'Response', 'Status', 'Responsible', 'Due Date', 'Action'];

export default function ContractRisksTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Risk Assessment</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track contract risks, response actions and due dates.</p>
      </div>

      {/* Risk Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Risk Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {RISK_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        Risk tracking will be enabled after the Risk Assessment backend unit.
      </p>

      {/* Risk Register table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Risk Register</h2>
          <button
            type="button"
            disabled
            title="Risk Assessment backend is not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Add Risk
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {RISK_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={RISK_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No risks tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
