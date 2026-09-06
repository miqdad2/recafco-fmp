'use client';

import { useMemo, useState } from 'react';
import { Download, PencilLine, FileSearch } from 'lucide-react';
import type { ContractDocumentObligation } from '@/lib/contracts-api';
import { ContractDocumentCategoryBadge } from './contract-document-category-badge';
import { ContractDocumentStatusBadge } from './contract-document-status-badge';
import { ContractDocumentFormModal } from './contract-document-form-modal';
import {
  DOCUMENT_OBLIGATION_CATEGORY_FILTER_OPTIONS,
  DOCUMENT_OBLIGATION_STATUS_FILTER_OPTIONS,
  formatDaysRemaining,
} from '../../../../_lib/contract-document-obligation-helpers';

interface Props {
  contractId: string;
  items: ContractDocumentObligation[];
  canUpdate: boolean;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; item: ContractDocumentObligation } | null;

/** Same "not settled" definition as the Expiring Soon / Expired-Overdue KPI cards — see contract-document-obligations.service.ts. */
const SETTLED_STATUSES = ['SUBMITTED', 'CANCELLED', 'NOT_REQUIRED'];

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABLE_COLUMNS = [
  'Item ID', 'Document / Obligation', 'Category', 'Responsible Party', 'Required Date',
  'Submission Date', 'Expiry Date', 'Days Remaining', 'Status', 'Remarks', 'Attachment', 'Action',
];

// CM-63B — Item ID (first) and Action (last) columns pinned while the other
// 9 columns scroll horizontally underneath, reusing Claims'/Risk's own
// established sticky-column pattern (itself reused from Contract List's
// contract-list-table.tsx). Opaque backgrounds required on both (header
// matches this table's own light bg-surface-secondary header, body uses
// bg-surface) — same known tradeoff as Claims/Risk: a sticky body cell does
// not pick up the row's own hover tint.
const STICKY_LEFT_HEADER_CLS = 'sticky left-0 z-10 bg-surface-secondary border-r border-border';
const STICKY_RIGHT_HEADER_CLS = 'sticky right-0 z-10 bg-surface-secondary border-l border-border';
const STICKY_LEFT_CLS = 'sticky left-0 z-10 bg-surface border-r border-border';
const STICKY_RIGHT_CLS = 'sticky right-0 z-10 bg-surface border-l border-border';

/**
 * CM-63 — Documents & Obligations search/filter row + table + Add/Edit
 * modal trigger, all in one client component. Same bounded, contract-
 * scoped, client-side-filtered pattern established for Risk Assessment/
 * Variations/Claims (documented in ui-registry.md) — a contract's document/
 * obligation list is small and fetched in full server-side, so search/
 * category/responsible-party/status/expiring-soon/overdue filtering happens
 * instantly with no round trip and no pagination. Responsible Party is a
 * free-text field (not a fixed enum), so its filter options are derived
 * from the real distinct values already present in this contract's own
 * items — never a fabricated fixed list. Attachment column shows the first
 * real uploaded file's name (+ "N more" for additional files) linking to
 * the secure download proxy route, or "—" when the item has no real
 * attachments yet.
 * CM-63B — pure UI polish, no filter/export/upload logic changed: Item ID/
 * Action columns pinned via sticky positioning (see constants above) so
 * both stay reachable while scrolling the remaining 9 columns.
 */
export function ContractDocumentPanel({ contractId, items, canUpdate }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [responsibleParty, setResponsibleParty] = useState('');
  const [status, setStatus] = useState('');
  const [expiringSoonOnly, setExpiringSoonOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const responsiblePartyOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of items) {
      if (item.responsibleParty) values.add(item.responsibleParty);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.title.toLowerCase().includes(q) && !(item.itemNo?.toLowerCase().includes(q) ?? false)) return false;
      if (category && item.category !== category) return false;
      if (responsibleParty && item.responsibleParty !== responsibleParty) return false;
      if (status && item.status !== status) return false;
      if (expiringSoonOnly) {
        if (SETTLED_STATUSES.includes(item.status)) return false;
        if (item.daysRemaining === undefined || item.daysRemaining < 0 || item.daysRemaining > 30) return false;
      }
      if (overdueOnly) {
        if (SETTLED_STATUSES.includes(item.status)) return false;
        if (item.daysRemaining === undefined || item.daysRemaining >= 0) return false;
      }
      return true;
    });
  }, [items, search, category, responsibleParty, status, expiringSoonOnly, overdueOnly]);

  const exportUrl = `/contracts/${contractId}/documents/export`;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by document / obligation…"
              aria-label="Search by document / obligation"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={`${inputCls} w-auto min-w-36`}>
              {DOCUMENT_OBLIGATION_CATEGORY_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Responsible Party</span>
            <select value={responsibleParty} onChange={(e) => setResponsibleParty(e.target.value)} aria-label="Responsible Party" className={`${inputCls} w-auto min-w-32`}>
              <option value="">All</option>
              {responsiblePartyOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={`${inputCls} w-auto min-w-32`}>
              {DOCUMENT_OBLIGATION_STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={expiringSoonOnly}
              onChange={(e) => setExpiringSoonOnly(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent"
            />
            Expiring Soon (30 days)
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent"
            />
            Overdue Only
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              title="Export this contract's Documents & Obligations as CSV (opens in Excel)"
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
                Add Document
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Documents & Obligations Register</h2>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No documents or obligations recorded yet.</p>
            <p className="text-xs text-text-muted">Add required contract documents, guarantees, certificates, approvals, or obligation deadlines.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No documents or obligations match the current search/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
            <table className="w-full min-w-350 divide-y divide-border text-xs">
              <thead className="border-b-2 border-border-strong">
                <tr className="bg-surface-secondary">
                  {TABLE_COLUMNS.map((col, index) => {
                    const stickyCls = index === 0 ? STICKY_LEFT_HEADER_CLS : index === TABLE_COLUMNS.length - 1 ? STICKY_RIGHT_HEADER_CLS : '';
                    return (
                      <th key={col} className={`px-3 py-2.5 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap ${stickyCls}`}>
                        {col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className={`px-3 py-2 whitespace-nowrap font-medium text-text-primary ${STICKY_LEFT_CLS}`}>{item.itemNo || '—'}</td>
                    <td className="px-3 py-2 max-w-64 truncate" title={item.title}>{item.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractDocumentCategoryBadge category={item.category} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.responsibleParty || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.requiredDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.submissionDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.expiryDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                      {item.daysRemaining !== undefined ? (
                        <span
                          className={
                            item.daysRemaining < 0
                              ? 'text-error font-medium'
                              : item.daysRemaining <= 30
                                ? 'text-warning font-medium'
                                : 'text-success font-medium'
                          }
                        >
                          {formatDaysRemaining(item.daysRemaining)}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractDocumentStatusBadge status={item.status} /></td>
                    <td className="px-3 py-2 max-w-48 truncate text-text-muted" title={item.remarks ?? undefined}>{item.remarks || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap max-w-48 truncate">
                      {item.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <a
                            href={`/contracts/${contractId}/documents/${item.id}/attachments/${item.attachments[0]!.id}/download`}
                            className="text-accent hover:underline truncate"
                            title={`Download ${item.attachments[0]!.originalFileName}`}
                          >
                            {item.attachments[0]!.originalFileName}
                          </a>
                          {item.attachments.length > 1 && (
                            <span className="shrink-0 text-text-muted">+{item.attachments.length - 1} more</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${STICKY_RIGHT_CLS}`}>
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', item })}
                          aria-label={`Update ${item.itemNo || item.title}`}
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
        <ContractDocumentFormModal contractId={contractId} mode="add" onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <ContractDocumentFormModal contractId={contractId} mode="edit" item={modal.item} onClose={() => setModal(null)} />
      )}
    </>
  );
}
