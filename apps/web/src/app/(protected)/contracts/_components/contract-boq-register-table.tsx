'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  type BoqRow,
  boqLineTotal,
  emptyBoqRow,
  unitLabel,
  REGISTER_UNIT_OPTIONS,
} from '../_lib/contract-boq-helpers';

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const numericInputCls = `${inputCls} text-right tabular-nums`;
// Labels show on small screens only; on desktop one header row labels every column.
const mobileLabelCls = 'mb-1 block text-xs font-medium text-text-secondary lg:hidden';
const DESKTOP_COLUMNS = 'lg:grid-cols-[2.25rem_minmax(0,1fr)_7rem_8rem_8rem_9rem_2.25rem]';
const ROW_GRID = `grid grid-cols-2 gap-3 ${DESKTOP_COLUMNS} lg:items-center`;

interface Props {
  rows: BoqRow[];
  onRowsChange: (rows: BoqRow[]) => void;
  formatTotal: (amount: number) => string;
}

/**
 * FMP-BOQ-01 — New Contract Register's BOQ input: one clean row per item
 * (S/N, Item Description, Unit, Contract Qty, Unit Price, calculated Total) with no
 * horizontal scrolling — rows wrap into a small grid on narrow screens.
 * Drawing Qty, Invoice Qty, progress and reference fields are deliberately not
 * collected here; they belong to BOQ tracking after the contract exists. The
 * fields still exist on the data model and Edit Contract (a separate table).
 * Contract Qty is the early contract/estimated quantity (stored in
 * `originalEstimatedQty`), not the final piece quantity.
 */
export function ContractBoqRegisterTable({ rows, onRowsChange, formatTotal }: Props): React.JSX.Element {
  function updateRow(id: string, field: keyof Omit<BoqRow, 'id'>, value: string): void {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  const totalAmount = rows.reduce((sum, row) => sum + boqLineTotal(row), 0);
  const canRemove = rows.length > 1;

  return (
    <div>
      <div
        className={`hidden lg:grid ${DESKTOP_COLUMNS} gap-3 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary`}
        aria-hidden="true"
      >
        <span>S/N</span>
        <span>Item Description</span>
        <span>Unit</span>
        <span className="text-right">Contract Qty</span>
        <span className="text-right">Unit Price</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.id} className="rounded-lg border border-border bg-surface-secondary/40 p-3">
            <div className={ROW_GRID}>
              <div className="col-span-2 text-xs font-semibold text-text-secondary lg:col-span-1 lg:text-sm lg:font-medium">
                <span className="lg:hidden">Item </span>
                {index + 1}
              </div>
              <div className="col-span-2 lg:col-span-1">
                <label htmlFor={`boq-desc-${row.id}`} className={mobileLabelCls}>Item Description</label>
                <input
                  id={`boq-desc-${row.id}`}
                  type="text"
                  value={row.description}
                  onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                  placeholder="Enter item description"
                  aria-label="Item Description"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor={`boq-unit-${row.id}`} className={mobileLabelCls}>Unit</label>
                <select
                  id={`boq-unit-${row.id}`}
                  value={row.unitOfMeasure}
                  onChange={(e) => updateRow(row.id, 'unitOfMeasure', e.target.value)}
                  aria-label="Unit"
                  className={inputCls}
                >
                  <option value="">Select unit</option>
                  {REGISTER_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{unitLabel(u)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`boq-qty-${row.id}`} className={mobileLabelCls}>Contract Qty</label>
                <input
                  id={`boq-qty-${row.id}`}
                  type="number"
                  min="0"
                  step="any"
                  value={row.originalEstimatedQty}
                  onChange={(e) => updateRow(row.id, 'originalEstimatedQty', e.target.value)}
                  placeholder="0"
                  aria-label="Contract Qty"
                  className={numericInputCls}
                />
              </div>
              <div>
                <label htmlFor={`boq-price-${row.id}`} className={mobileLabelCls}>Unit Price</label>
                <input
                  id={`boq-price-${row.id}`}
                  type="number"
                  min="0"
                  step="any"
                  value={row.unitPrice}
                  onChange={(e) => updateRow(row.id, 'unitPrice', e.target.value)}
                  placeholder="0.000"
                  aria-label="Unit Price"
                  className={numericInputCls}
                />
              </div>
              <div>
                <span className={mobileLabelCls}>Total</span>
                <div
                  className="rounded-md bg-surface-secondary px-3 py-2 text-right text-sm font-medium tabular-nums text-text-secondary"
                  title="Contract Qty × Unit Price"
                >
                  {formatTotal(boqLineTotal(row))}
                </div>
              </div>
              <div className="col-span-2 flex justify-end lg:col-span-1">
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => onRowsChange(rows.filter((r) => r.id !== row.id))}
                    aria-label={`Remove item ${index + 1}`}
                    title="Remove item"
                    className="rounded p-2 text-text-muted hover:text-error focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onRowsChange([...rows, emptyBoqRow()])}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Item
        </button>
        <div className="rounded-md border border-accent/20 bg-accent/5 px-5 py-2.5 text-right">
          <p className="text-xs text-text-muted">Total Amount</p>
          <p className="text-lg font-bold tabular-nums text-text-primary">{formatTotal(totalAmount)}</p>
        </div>
      </div>
    </div>
  );
}
