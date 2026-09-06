'use client';

import { useMemo, useState } from 'react';
import { Download, PencilLine, Check, X as XIcon, FileSearch } from 'lucide-react';
import type { ContractVariation } from '@/lib/contracts-api';
import { ContractVariationStatusBadge } from './contract-variation-status-badge';
import { ContractVariationFormModal } from './contract-variation-form-modal';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';
import {
  VARIATION_STATUS_FILTER_OPTIONS,
  AFFECTS_CONTRACT_VALUE_FILTER_OPTIONS,
  SUBMITTED_DATE_FILTER_OPTIONS,
  matchesSubmittedDateFilter,
} from '../../../../_lib/contract-variation-helpers';
import type { SubmittedDateFilter } from '../../../../_lib/contract-variation-helpers';

interface Props {
  contractId: string;
  variations: ContractVariation[];
  canUpdate: boolean;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; variation: ContractVariation } | null;

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * CM-60 — Variations / Change Orders search/filter row + table + Add/Edit
 * modal trigger, all in one client component. Same bounded, contract-scoped,
 * client-side-filtered pattern established for Production Status (CM-59/
 * CM-59B, documented in ui-registry.md) — a contract's variation list is
 * small and already fetched in full server-side, so search/status/submitted-
 * date/affects-value filtering happens instantly with no round trip and no
 * pagination. Supporting Document is shown as a link only when a real
 * supportingDocumentUrl exists (opens in a new tab); otherwise the plain
 * name or "—" — never a fake document.
 * CM-60B — small uppercase labels added above the Status/Submitted Date/
 * Affects Contract Value selects (their `aria-label`s were already correct,
 * but nothing was visible) so a manager doesn't have to guess what each
 * dropdown filters by; Affects Contract Value's own option labels
 * simplified back to plain "All"/"Yes"/"No" now that the group has a
 * visible heading, instead of repeating "Affects Value:" in every option.
 * Empty state reworded to the approved copy; filtering/export/add
 * behavior unchanged.
 * CM-60C — Supporting Document column now shows the first real uploaded
 * attachment's name (+ "N more" for additional files), linking to the
 * secure download proxy route — never a raw filesystem path. Falls back to
 * the older supportingDocumentName/supportingDocumentUrl text/link fields
 * only when a variation has no real uploaded attachments (backwards
 * compatibility with CM-60 data), then "—" when neither exists.
 */
export function ContractVariationPanel({ contractId, variations, canUpdate }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [affectsValue, setAffectsValue] = useState('');
  const [submittedDateFilter, setSubmittedDateFilter] = useState<SubmittedDateFilter>('');
  const [modal, setModal] = useState<ModalState>(null);

  const filteredVariations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variations.filter((v) => {
      if (q && !v.description.toLowerCase().includes(q) && !(v.variationNo?.toLowerCase().includes(q) ?? false)) return false;
      if (status && v.status !== status) return false;
      if (affectsValue && String(v.affectsContractValue) !== affectsValue) return false;
      if (!matchesSubmittedDateFilter(v.submittedDate, submittedDateFilter)) return false;
      return true;
    });
  }, [variations, search, status, affectsValue, submittedDateFilter]);

  const exportUrl = `/contracts/${contractId}/variations/export`;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-44">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variation description…"
              aria-label="Search variation description"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={`${inputCls} w-auto min-w-32`}>
              {VARIATION_STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Submitted Date</span>
            <select
              value={submittedDateFilter}
              onChange={(e) => setSubmittedDateFilter(e.target.value as SubmittedDateFilter)}
              aria-label="Submitted Date"
              className={`${inputCls} w-auto min-w-32`}
            >
              {SUBMITTED_DATE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Affects Contract Value</span>
            <select value={affectsValue} onChange={(e) => setAffectsValue(e.target.value)} aria-label="Affects Contract Value" className={`${inputCls} w-auto min-w-28`}>
              {AFFECTS_CONTRACT_VALUE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              title="Export this contract's Variations as CSV (opens in Excel)"
            >
              <Download className="size-3.5 shrink-0" aria-hidden="true" />
              Export Excel
            </a>
            {canUpdate && (
              <button
                type="button"
                onClick={() => setModal({ mode: 'add' })}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Add Variation
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm p-5">
        {variations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No variations recorded yet.</p>
            <p className="text-xs text-text-muted">Add the first variation when there is a client/site/contract change.</p>
          </div>
        ) : filteredVariations.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-md border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No variations match the current search/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-350 divide-y divide-border text-xs">
              <thead className="border-b-2 border-border-strong">
                <tr className="bg-surface-secondary">
                  {['Variation No.', 'Description', 'Amount (KWD)', 'Affects Contract Value', 'Status', 'Supporting Document', 'Submitted Date', 'Approved Date', 'Remarks', 'Action'].map((col) => (
                    <th key={col} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {filteredVariations.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-text-primary">{v.variationNo || '—'}</td>
                    <td className="px-3 py-2 max-w-60 truncate" title={v.description}>{v.description}</td>
                    <td className={`px-3 py-2 whitespace-nowrap text-right tabular-nums font-medium ${v.amount && parseFloat(v.amount) < 0 ? 'text-error' : 'text-success'}`}>
                      {formatContractValue(v.amount, undefined)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      {v.affectsContractValue ? (
                        <Check className="size-3.5 text-success inline-block" aria-label="Yes" />
                      ) : (
                        <XIcon className="size-3.5 text-text-muted inline-block" aria-label="No" />
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractVariationStatusBadge status={v.status} /></td>
                    <td className="px-3 py-2 whitespace-nowrap max-w-48 truncate">
                      {v.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <a
                            href={`/contracts/${contractId}/variations/${v.id}/attachments/${v.attachments[0]!.id}/download`}
                            className="text-accent hover:underline truncate"
                            title={`Download ${v.attachments[0]!.originalFileName}`}
                          >
                            {v.attachments[0]!.originalFileName}
                          </a>
                          {v.attachments.length > 1 && (
                            <span className="shrink-0 text-text-muted">+{v.attachments.length - 1} more</span>
                          )}
                        </span>
                      ) : v.supportingDocumentUrl ? (
                        <a href={v.supportingDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline" title={v.supportingDocumentUrl}>
                          {v.supportingDocumentName || v.supportingDocumentUrl}
                        </a>
                      ) : v.supportingDocumentName ? (
                        v.supportingDocumentName
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(v.submittedDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(v.approvedDate)}</td>
                    <td className="px-3 py-2 max-w-40 truncate text-text-muted" title={v.remarks ?? undefined}>{v.remarks || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', variation: v })}
                          aria-label={`Update variation ${v.variationNo || v.description}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-text-secondary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          <PencilLine className="size-3.5 shrink-0" aria-hidden="true" />
                          Update
                        </button>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.mode === 'add' && (
        <ContractVariationFormModal contractId={contractId} mode="add" onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <ContractVariationFormModal contractId={contractId} mode="edit" variation={modal.variation} onClose={() => setModal(null)} />
      )}
    </>
  );
}
