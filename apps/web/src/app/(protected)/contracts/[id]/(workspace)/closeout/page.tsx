import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contract Closeout — Contract Management — RECAFCO FMP' };

const CLOSEOUT_STATUS_ROWS = ['Closeout Readiness', 'Overall Completion', 'Payment Completion', 'Pending Documents', 'Open Issues'];

const CHECKLIST_COLUMNS = ['Checklist Item', 'Status', 'Responsible', 'Completed Date', 'Action'];

const CHECKLIST_ITEMS = [
  'All workflow steps completed',
  'Production workflow completed',
  'Delivery completed',
  'Erection completed',
  'Final inspection completed',
  'All required documents submitted',
  'Final payment received / confirmed',
  'Client acceptance received',
];

const APPROVAL_ROWS = [
  'Prepared By', 'Prepared Date', 'Reviewed By', 'Reviewed Date',
  'Approved By', 'Approved Date', 'Closure Date', 'Final Status',
];

export default function ContractCloseoutTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Contract Closeout</h1>
        <p className="text-xs text-text-secondary mt-0.5">Final verification before closing and archiving the contract.</p>
      </div>

      {/* Closeout Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Closeout Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          {CLOSEOUT_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not started</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        Closeout validation will be enabled after the Closeout backend unit.
      </p>

      {/* Closeout Checklist */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Closeout Checklist</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {CHECKLIST_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {CHECKLIST_ITEMS.map((item) => (
                <tr key={item}>
                  <td className="px-3 py-2 text-text-primary">{item}</td>
                  <td className="px-3 py-2 text-text-muted">Not started</td>
                  <td className="px-3 py-2 text-text-muted">—</td>
                  <td className="px-3 py-2 text-text-muted">—</td>
                  <td className="px-3 py-2 text-text-muted">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Final Approval */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Final Approval</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {APPROVAL_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not started</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
