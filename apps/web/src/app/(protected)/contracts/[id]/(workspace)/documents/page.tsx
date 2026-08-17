import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

export const metadata: Metadata = { title: 'Documents & Obligations — Contract Management — RECAFCO FMP' };

const DOCUMENT_STATUS_ROWS = ['Total Items', 'Submitted', 'Pending', 'Expiring Soon', 'Expired / Overdue'];

const DOCUMENT_COLUMNS = ['Item ID', 'Document / Obligation', 'Category', 'Responsible', 'Required Date', 'Due / Expiry Date', 'Status', 'Action'];

export default function ContractDocumentsTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Documents & Obligations</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track required documents, obligations and expiry dates.</p>
      </div>

      {/* Document Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Document Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          {DOCUMENT_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        Document and obligation tracking will be enabled after the Documents backend unit.
      </p>

      {/* Documents & Obligations Register table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Documents & Obligations Register</h2>
          <button
            type="button"
            disabled
            title="Documents backend and upload support are not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Add Document
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {DOCUMENT_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={DOCUMENT_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No documents or obligations tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
