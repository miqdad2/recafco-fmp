import type { Metadata } from 'next';
import { Upload } from 'lucide-react';

export const metadata: Metadata = { title: 'Attachments / Document Library — Contract Management — RECAFCO FMP' };

const FILE_STATUS_ROWS = ['Total Files', 'Pending Review', 'Approved Documents', 'Missing Required'];

const ATTACHMENT_COLUMNS = ['File Name', 'Category', 'Source', 'Uploaded By', 'Uploaded Date', 'Status', 'Action'];

export default function ContractAttachmentsTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Attachments / Document Library</h1>
        <p className="text-xs text-text-secondary mt-0.5">Store and manage contract-related files.</p>
      </div>

      {/* File Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">File Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {FILE_STATUS_ROWS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">Not tracked yet</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        File upload and document library tracking will be enabled after the Attachments backend unit.
      </p>

      {/* Attachments table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Attachments</h2>
          <button
            type="button"
            disabled
            title="File upload support is not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Upload className="size-3.5 shrink-0" aria-hidden="true" />
            Upload File
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {ATTACHMENT_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={ATTACHMENT_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No contract files uploaded yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
