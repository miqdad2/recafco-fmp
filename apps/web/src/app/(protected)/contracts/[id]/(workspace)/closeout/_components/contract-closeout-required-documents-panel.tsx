import Link from 'next/link';
import { FolderOpen, ArrowUpRight, Download } from 'lucide-react';
import type { ContractDocumentObligation } from '@/lib/contracts-api';
import { DOCUMENT_OBLIGATION_CATEGORY_LABELS } from '../../../../_lib/contract-document-obligation-helpers';
import { ContractCloseoutDocumentStatusBadge } from './contract-closeout-document-status-badge';

interface Props {
  contractId: string;
  items: ContractDocumentObligation[];
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABLE_COLUMNS = ['Document / Obligation', 'Category', 'Status', 'Submission Date', 'Expiry Date', 'Attachment', 'Action'];

/**
 * CM-67E — Required Documents for Closeout: a read-only readiness summary
 * over the real, already-existing Documents & Obligations records for this
 * contract (contractsApi.getContractDocumentObligations(), the same fetch
 * page.tsx already made for the KPI strip and checklist — no new request).
 * Replaces the old "Final Documents / Attachments" card, which showed only
 * closeout-request attachments and an upload form — that gave the false
 * impression Closeout was where required documents get uploaded. Required
 * documents are managed and uploaded in Documents & Obligations; this card
 * only shows whether they're ready. No upload control here — see
 * contract-closeout-request-attachments.tsx (moved into the Final Approval
 * & Closeout section) for the real closeout-request attachment upload,
 * which is a genuinely different real thing (supporting files for the
 * closeout REQUEST itself, not a contract requirement).
 */
export function ContractCloseoutRequiredDocumentsPanel({ contractId, items }: Props): React.JSX.Element {
  const documentsHref = `/contracts/${contractId}/documents`;

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Required Documents for Closeout</h2>
        <p className="text-xs text-text-secondary mt-0.5">Shows required contract documents and whether supporting files are uploaded before closeout.</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6 text-center">
          <FolderOpen className="size-5 text-text-muted shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium text-text-secondary">No required closeout documents defined yet.</p>
          <p className="text-xs text-text-muted max-w-sm">
            Add required certificates, approvals, guarantees, final invoices, handover, or retention documents in Documents & Obligations.
          </p>
          <Link
            href={documentsHref}
            className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to Documents & Obligations
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border max-h-80">
          <table className="w-full min-w-200 divide-y divide-border text-xs">
            <thead className="sticky top-0 z-10 border-b-2 border-border-strong">
              <tr className="bg-surface-secondary">
                {TABLE_COLUMNS.map((col) => (
                  <th key={col} className="px-2 py-2 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {items.map((item) => {
                const firstAttachment = item.attachments[0];
                return (
                  <tr key={item.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-2 py-1 max-w-40 truncate text-text-primary font-medium" title={item.title}>{item.title}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-text-secondary">{DOCUMENT_OBLIGATION_CATEGORY_LABELS[item.category]}</td>
                    <td className="px-2 py-1 whitespace-nowrap"><ContractCloseoutDocumentStatusBadge status={item.status} /></td>
                    <td className="px-2 py-1 whitespace-nowrap text-text-secondary">{formatDate(item.submissionDate)}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-text-secondary">{formatDate(item.expiryDate)}</td>
                    <td className="px-2 py-1 max-w-32 whitespace-nowrap">
                      {firstAttachment ? (
                        <span className="inline-flex items-center gap-1">
                          <a
                            href={`/contracts/${contractId}/documents/${item.id}/attachments/${firstAttachment.id}/download`}
                            className="text-info hover:underline truncate"
                            title={`Download ${firstAttachment.originalFileName}`}
                          >
                            {firstAttachment.originalFileName}
                          </a>
                          {item.attachments.length > 1 && (
                            <span className="shrink-0 text-text-muted">+{item.attachments.length - 1} more</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {firstAttachment ? (
                        <a
                          href={`/contracts/${contractId}/documents/${item.id}/attachments/${firstAttachment.id}/download`}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-1 font-medium text-text-primary hover:border-accent hover:bg-accent-light hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                          title={`Download ${firstAttachment.originalFileName}`}
                        >
                          <Download className="size-3 shrink-0" aria-hidden="true" />
                          Download
                        </a>
                      ) : (
                        <Link
                          href={documentsHref}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-1 font-medium text-text-primary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                          title="Open Documents & Obligations"
                        >
                          Go to Documents
                          <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
