import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

export const metadata: Metadata = { title: 'Payments — Contract Management — RECAFCO FMP' };

const PAYMENT_STATUS_ROWS = ['Total Submitted', 'Total Paid', 'Outstanding', 'Overdue', 'Next Due Payment'];

const PAYMENT_TRACKER_COLUMNS = [
  'Payment No.', 'Amount', 'Submitted Date', 'Received Date', 'Paid Amount', 'Remaining Amount', 'Status', 'Action',
];

export default function ContractPaymentsTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Payments</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track submitted, paid, outstanding and overdue payments.</p>
      </div>

      {/* Payment Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Payment Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          {PAYMENT_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        Payment tracking will be enabled after the Payments backend unit.
      </p>

      {/* Payment Tracker */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Payment Tracker</h2>
          <button
            type="button"
            disabled
            title="Payments backend is not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Add Payment
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {PAYMENT_TRACKER_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={PAYMENT_TRACKER_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No payment records tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
