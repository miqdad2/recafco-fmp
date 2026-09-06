'use client';

import { useMemo, useState } from 'react';
import { Download, PencilLine, PackageSearch, X } from 'lucide-react';
import type { ContractProductionItem } from '@/lib/contracts-api';
import { ContractProductionStatusBadge } from './contract-production-status-badge';
import { ContractProductionFormModal } from './contract-production-form-modal';
import {
  PRODUCTION_STATUS_FILTER_OPTIONS,
  PRODUCTION_STATUS_BAR_CLASSES,
  formatQty,
} from '../../../../_lib/contract-production-helpers';

interface Props {
  contractId: string;
  items: ContractProductionItem[];
  canUpdate: boolean;
}

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * CM-59 — Production Status search/filter row + table + Add/Update
 * Production modal trigger, all in one client component. Unlike the
 * Payments tab (searchParams-driven, paginated), a contract's BOQ item list
 * is small and already fetched in full server-side — so search/status/
 * category filtering happens instantly client-side over the real fetched
 * `items`, with no round trip and no "Apply Filters" step. Category options
 * are the real distinct, non-empty `category` values present on this
 * contract's own BOQ items — never a fabricated list.
 * CM-59B — filter/action row collapsed to a single flex-wrap row (was a
 * label-per-field grid stacked above a separate actions row) so it reads as
 * one compact bar on desktop instead of a tall two-row card; fields keep
 * `aria-label`s since their own visible `<label>`s were removed. Filtering/
 * export/add-update behavior is unchanged — only the layout markup moved.
 */
export function ContractProductionPanel({ contractId, items, canUpdate }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [editingItem, setEditingItem] = useState<ContractProductionItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItemId, setPickerItemId] = useState('');

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.category?.trim()) set.add(item.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.description.toLowerCase().includes(q) && !(item.itemCode?.toLowerCase().includes(q) ?? false)) return false;
      if (status && item.status !== status) return false;
      if (category && item.category !== category) return false;
      return true;
    });
  }, [items, search, status, category]);

  const exportUrl = `/contracts/${contractId}/production/export`;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="production-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item description…"
            aria-label="Search item description"
            className={`${inputCls} flex-1 min-w-44`}
          />
          <select
            id="production-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Production Status"
            className={`${inputCls} w-auto min-w-36`}
          >
            {PRODUCTION_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            id="production-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
            className={`${inputCls} w-auto min-w-32`}
          >
            <option value="">All Categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              title="Export this contract's Production Status as CSV (opens in Excel)"
            >
              <Download className="size-3.5 shrink-0" aria-hidden="true" />
              Export Excel
            </a>
            {canUpdate && items.length > 0 && (
              <button
                type="button"
                onClick={() => { setPickerItemId(items[0]!.id); setPickerOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Add / Update Production
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm p-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface-secondary/40 py-10 text-center">
            <PackageSearch className="size-5 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No BOQ items available for production tracking.</p>
            <p className="text-xs text-text-muted">Add BOQ items from contract register/edit first.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-md border border-dashed border-border bg-surface-secondary/40 py-6">
            <PackageSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No items match the current search/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-350 divide-y divide-border text-xs">
              <thead className="border-b-2 border-border-strong">
                <tr className="bg-surface-secondary">
                  {['S/N', 'Item Description', 'Unit', 'Total Qty', 'Casted / Produced', 'Delivered', 'Stock / Not Delivered', 'Remaining to Cast', 'Production Status', 'Progress', 'Last Update', 'Remarks', 'Action'].map((col) => (
                    <th key={col} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {filteredItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-3 py-2 text-center text-text-muted tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2 max-w-60 truncate" title={item.description}>{item.description}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.unitOfMeasure ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatQty(item.totalQty)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums text-success font-medium">{formatQty(item.producedQty)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatQty(item.deliveredQty)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatQty(item.stockNotDelivered)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatQty(item.remainingToCast)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractProductionStatusBadge status={item.status} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2 w-28">
                        <div className="h-2 flex-1 rounded-full bg-surface-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${PRODUCTION_STATUS_BAR_CLASSES[item.status]}`}
                            style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                          />
                        </div>
                        <span className="text-text-secondary tabular-nums shrink-0 font-medium">{item.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.updatedAt)}</td>
                    <td className="px-3 py-2 max-w-40 truncate text-text-muted" title={item.remarks ?? undefined}>{item.remarks || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() => setEditingItem(item)}
                          aria-label={`Update production for ${item.description}`}
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

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="production-picker-title"
        >
          <div className="w-[min(96vw,440px)] rounded-lg border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h2 id="production-picker-title" className="text-sm font-semibold text-text-primary">Select an item to update</h2>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <select value={pickerItemId} onChange={(e) => setPickerItemId(e.target.value)} className={`${inputCls} w-full`}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemCode ? `${item.itemCode} — ` : ''}{item.description}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const chosen = items.find((i) => i.id === pickerItemId);
                  if (chosen) setEditingItem(chosen);
                  setPickerOpen(false);
                }}
                className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <ContractProductionFormModal contractId={contractId} item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </>
  );
}
