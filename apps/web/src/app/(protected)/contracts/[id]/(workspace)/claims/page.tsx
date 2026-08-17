import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

export const metadata: Metadata = { title: 'Claims Registry — Contract Management — RECAFCO FMP' };

const CLAIM_STATUS_ROWS = ['Open Claims', 'Submitted Value', 'Approved Value', 'Outstanding Value', 'Overdue Actions'];

const CLAIMS_COLUMNS = [
  'Claim ID', 'Claim Title', 'Claim Type', 'Status', 'Submitted Value', 'Approved Value', 'Outstanding Value', 'Next Action', 'Due Date', 'Action',
];

export default function ContractClaimsTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Claims Registry</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track contract claims, values and next actions.</p>
      </div>

      {/* Claim Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Claim Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          {CLAIM_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        Claim tracking will be enabled after the Claims Registry backend unit.
      </p>

      {/* Claims Registry table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Claims Registry</h2>
          <button
            type="button"
            disabled
            title="Claims Registry backend is not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Add Claim
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {CLAIMS_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={CLAIMS_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No claims tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
