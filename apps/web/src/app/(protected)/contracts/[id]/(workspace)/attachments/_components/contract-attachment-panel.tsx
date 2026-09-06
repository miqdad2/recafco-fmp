'use client';

import { useMemo, useState } from 'react';
import { Download, Paperclip, FileSearch } from 'lucide-react';
import type { ContractAttachment, ContractAttachmentSource } from '@/lib/contracts-api';
import { ContractAttachmentSourceBadge } from './contract-attachment-source-badge';
import { ContractAttachmentCategoryBadge } from './contract-attachment-category-badge';
import { ContractAttachmentStatusBadge } from './contract-attachment-status-badge';
import {
  ATTACHMENT_SOURCE_FILTER_OPTIONS,
  ATTACHMENT_STATUS_LABEL,
  deriveAttachmentCategory,
  deriveAttachmentType,
  formatAttachmentSize,
} from '../../../../_lib/contract-attachment-helpers';

interface Props {
  contractId: string;
  attachments: ContractAttachment[];
}

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABLE_COLUMNS = ['File Name', 'Category', 'Source', 'Related To', 'Uploaded By', 'Uploaded Date', 'Status', 'Type', 'Size', 'Action'];

// CM-64 — File Name (first) and Action (last) columns pinned, reusing the
// established sticky-column pattern (contract-claim-panel.tsx / Contract
// List's own contract-list-table.tsx).
const STICKY_LEFT_HEADER_CLS = 'sticky left-0 z-10 bg-surface-secondary border-r border-border';
const STICKY_RIGHT_HEADER_CLS = 'sticky right-0 z-10 bg-surface-secondary border-l border-border';
const STICKY_LEFT_CLS = 'sticky left-0 z-10 bg-surface border-r border-border';
const STICKY_RIGHT_CLS = 'sticky right-0 z-10 bg-surface border-l border-border';

/**
 * CM-64 — Attachments / Document Library search/filter row + table, all in
 * one client component. Same bounded, contract-scoped, client-side-filtered
 * pattern established for Risk Assessment/Documents & Obligations/Claims —
 * this contract's real cross-tab attachment list is already fetched in
 * full server-side (contractsApi.getContractAttachments()), so search/
 * source/uploaded-by/date filtering happens instantly with no round trip.
 * No Upload File action here — every file's real upload path lives in its
 * own source tab (Workflow, Variations, Documents & Obligations, Closeout);
 * this page is a read-only cross-tab library, not a 5th upload path.
 * Uploaded By filter options are derived from the real distinct uploader
 * names already present in this contract's own attachments, never a
 * fabricated fixed list.
 * CM-64B — added Category (deriveAttachmentCategory() — real Documents &
 * Obligations category when the backend provided one, otherwise a safe
 * source-derived label) and Status ("Uploaded" always — see
 * ATTACHMENT_STATUS_LABEL, never a fabricated Approved/Pending Review)
 * columns; "Related Item" renamed "Related To" to match the approved
 * design; search now also matches on the derived category.
 * CM-64C — File Name link recolored from `text-accent` (this theme's brand
 * red, #c62828 — reads as an error/danger state) to `text-info` (real
 * blue, #175cd3 — a normal hyperlink color); the Variation source badge
 * was recolored for the same reason (see ATTACHMENT_SOURCE_BADGE_CLASSES).
 * No data, filter, download, or export logic changed.
 */
export function ContractAttachmentPanel({ contractId, attachments }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<ContractAttachmentSource | ''>('');
  const [uploadedBy, setUploadedBy] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const uploadedByOptions = useMemo(() => {
    const values = new Set<string>();
    for (const a of attachments) {
      if (a.uploadedByUser) values.add(a.uploadedByUser.displayName);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [attachments]);

  const filteredAttachments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attachments.filter((a) => {
      if (
        q &&
        !a.originalFileName.toLowerCase().includes(q) &&
        !a.sourceLabel.toLowerCase().includes(q) &&
        !a.relatedItemTitle.toLowerCase().includes(q) &&
        !deriveAttachmentCategory(a).toLowerCase().includes(q)
      ) {
        return false;
      }
      if (source && a.source !== source) return false;
      if (uploadedBy && a.uploadedByUser?.displayName !== uploadedBy) return false;
      const uploadedDate = a.createdAt.slice(0, 10);
      if (dateFrom && uploadedDate < dateFrom) return false;
      if (dateTo && uploadedDate > dateTo) return false;
      return true;
    });
  }, [attachments, search, source, uploadedBy, dateFrom, dateTo]);

  const exportUrl = `/contracts/${contractId}/attachments/export`;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-56">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name, category, source, or related item…"
              aria-label="Search by file name, category, source, or related item"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as ContractAttachmentSource | '')}
              aria-label="Source"
              className={`${inputCls} w-auto min-w-40`}
            >
              {ATTACHMENT_SOURCE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Uploaded By</span>
            <select value={uploadedBy} onChange={(e) => setUploadedBy(e.target.value)} aria-label="Uploaded By" className={`${inputCls} w-auto min-w-32`}>
              <option value="">All Users</option>
              {uploadedByOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Date Range</span>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Uploaded date from" className={inputCls} />
              <span className="text-text-muted">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Uploaded date to" className={inputCls} />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              title="Export this contract's attachment list as CSV (opens in Excel)"
            >
              <Download className="size-3.5 shrink-0" aria-hidden="true" />
              Export List
            </a>
          </div>
        </div>
      </section>

      <section>
        {attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <Paperclip className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No attachments uploaded yet.</p>
            <p className="text-xs text-text-muted">Files uploaded from Workflow, Variations, Documents &amp; Obligations, or Closeout will appear here.</p>
          </div>
        ) : filteredAttachments.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No attachments match the current search/filters.</p>
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
                {filteredAttachments.map((a) => (
                  <tr key={`${a.source}-${a.id}`} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className={`px-3 py-2 max-w-64 truncate ${STICKY_LEFT_CLS}`}>
                      <a
                        href={a.downloadPath}
                        className="inline-flex items-center gap-1.5 text-info hover:underline"
                        title={`Download ${a.originalFileName}`}
                      >
                        <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                        {a.originalFileName}
                      </a>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractAttachmentCategoryBadge category={deriveAttachmentCategory(a)} /></td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractAttachmentSourceBadge source={a.source} label={a.sourceLabel} /></td>
                    <td className="px-3 py-2 max-w-56 truncate" title={a.relatedItemTitle}>{a.relatedItemTitle || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{a.uploadedByUser?.displayName ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractAttachmentStatusBadge status={ATTACHMENT_STATUS_LABEL} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{deriveAttachmentType(a.mimeType, a.originalFileName)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatAttachmentSize(a.fileSize)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${STICKY_RIGHT_CLS}`}>
                      <a
                        href={a.downloadPath}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-text-secondary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                        title={`Download ${a.originalFileName}`}
                      >
                        <Download className="size-3.5 shrink-0" aria-hidden="true" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
