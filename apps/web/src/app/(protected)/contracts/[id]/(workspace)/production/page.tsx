import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const metadata: Metadata = { title: 'Production Status — Contract Management — RECAFCO FMP' };

const PRODUCTION_TRACKING_ROWS = ['Total Qty', 'Casted / Produced', 'Delivered', 'Remaining to Cast', 'Production Progress'];

const PRODUCTION_COLUMNS = ['Item Description', 'Unit', 'Total Qty', 'Casted / Produced', 'Delivered', 'Remaining to Cast', 'Status', 'Action'];

export default function ContractProductionStatusTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Production Status</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track casting, delivery and remaining production.</p>
      </div>

      {/* Production Tracking Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Production Tracking Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          {PRODUCTION_TRACKING_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          Production tracking will be enabled after the Production backend unit. Future release: this can be linked with the Production module.
        </p>
        <Link
          href="/production"
          className="shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          View Production Module
        </Link>
      </div>

      {/* Production Status table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Production Status</h2>
          <button
            type="button"
            disabled
            title="Production backend is not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Add / Update Production
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {PRODUCTION_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={PRODUCTION_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No production records tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
