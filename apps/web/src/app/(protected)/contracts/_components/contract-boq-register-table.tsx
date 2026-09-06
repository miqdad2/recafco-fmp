'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  type BoqRow,
  boqLineTotal,
  boqProgressPercent,
  boqAmountRemaining,
  emptyRegisterBoqRow,
  UNIT_OF_MEASURE_OPTIONS,
} from '../_lib/contract-boq-helpers';

const BOQ_COLUMNS = [
  'S/N', 'Item Description', 'Unit', 'BOQ Qty / Area', 'Unit Price (U/P) KWD', 'Total Price (T/P) KWD',
  'Drawing Qty', 'Invoice Qty', 'Progress / Invoice %', 'Amount Remaining KWD', 'Drawing Ref.', 'Calculation Ref.', 'Action',
];
// CM-56D — the numeric/amount columns (both editable and calculated) are
// right-aligned in the body, so their headers line up with the values below.
const RIGHT_ALIGNED_COLUMNS = new Set([
  'BOQ Qty / Area', 'Unit Price (U/P) KWD', 'Total Price (T/P) KWD', 'Drawing Qty', 'Invoice Qty', 'Progress / Invoice %', 'Amount Remaining KWD',
]);

const boqInputCls =
  'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const boqNumericInputCls = `${boqInputCls} text-right tabular-nums`;
// CM-56D — calculated (never user-editable) cells: a muted, borderless box
// that visually reads as "not an input" without a real disabled <input>
// (which would submit as part of the form and duplicate the real hidden
// contractValue/boqItems payload for no reason — these values are always
// re-derived from the row's own real fields).
const boqReadOnlyCls = 'rounded-md bg-surface-secondary px-2 py-1.5 text-right tabular-nums font-medium text-text-secondary';

interface Props {
  rows: BoqRow[];
  onRowsChange: (rows: BoqRow[]) => void;
  formatTotal: (amount: number) => string;
}

/**
 * CM-56 — New Contract Register's own BOQ table, matching the approved
 * design exactly: BOQ Qty / Area (contract BOQ is originally issued in m²;
 * exact item qty/count is often refined later), Drawing Qty (CM-56D —
 * quantity confirmed during drawing/calculation stages, informational only,
 * never affects Total Price/Progress/Amount Remaining), Invoice Qty,
 * "Progress / Invoice %" (never "P/R" — the old label was confusing),
 * Amount Remaining, and optional Drawing Ref. / Calculation Ref. per item.
 * Deliberately a SEPARATE component from `contract-boq-table.tsx` (which
 * Edit Contract keeps using unchanged, with its full itemCode/category/mix
 * design/concrete grade field set) — not a redesign of the shared table,
 * so Edit Contract's BOQ editing experience is completely unaffected by
 * this unit. "Calculation Ref." reuses the existing `specificationReference`
 * column (closest real semantic match — see contract-boq-helpers.ts).
 */
export function ContractBoqRegisterTable({ rows, onRowsChange, formatTotal }: Props): React.JSX.Element {
  function updateRow(id: string, field: keyof Omit<BoqRow, 'id'>, value: string): void {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow(): void {
    onRowsChange([...rows, emptyRegisterBoqRow()]);
  }

  function removeRow(id: string): void {
    if (rows.length <= 1) return;
    onRowsChange(rows.filter((r) => r.id !== id));
  }

  const totalAmount = rows.reduce((sum, row) => sum + boqLineTotal(row), 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-375 divide-y divide-border text-xs">
          <thead className="border-b-2 border-border-strong">
            <tr className="bg-surface-secondary">
              {BOQ_COLUMNS.map((col) => (
                <th
                  key={col}
                  className={`px-3 py-2 font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap ${RIGHT_ALIGNED_COLUMNS.has(col) ? 'text-right' : 'text-left'}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {rows.map((row, index) => {
              const lineTotal = boqLineTotal(row);
              const progressPercent = boqProgressPercent(row);
              const amountRemaining = boqAmountRemaining(row);
              return (
                <tr key={row.id}>
                  <td className="px-3 py-1.5 text-text-muted">{index + 1}</td>
                  <td className="px-3 py-1.5 min-w-80">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                      placeholder="Enter item description"
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <select
                      value={row.unitOfMeasure}
                      onChange={(e) => updateRow(row.id, 'unitOfMeasure', e.target.value)}
                      className={boqInputCls}
                    >
                      <option value="">—</option>
                      {UNIT_OF_MEASURE_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.originalEstimatedQty}
                      onChange={(e) => updateRow(row.id, 'originalEstimatedQty', e.target.value)}
                      placeholder="0.000"
                      className={boqNumericInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-28">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(row.id, 'unitPrice', e.target.value)}
                      placeholder="0.000"
                      className={boqNumericInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-32">
                    <div className={boqReadOnlyCls} title="Calculated: BOQ Qty × Unit Price">
                      {lineTotal > 0 ? formatTotal(lineTotal) : '—'}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.drawingQty}
                      onChange={(e) => updateRow(row.id, 'drawingQty', e.target.value)}
                      placeholder="0.000"
                      className={boqNumericInputCls}
                      title="Quantity confirmed from drawing/calculation — informational, does not affect Total Price/Progress/Amount Remaining"
                    />
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.invoiceQty}
                      onChange={(e) => updateRow(row.id, 'invoiceQty', e.target.value)}
                      placeholder="0.000"
                      className={boqNumericInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-20">
                    <div className={boqReadOnlyCls} title="Calculated: Invoice Qty ÷ BOQ Qty × 100">
                      {progressPercent}%
                    </div>
                  </td>
                  <td className="px-3 py-1.5 w-32">
                    <div className={boqReadOnlyCls} title="Calculated: Total Price − Invoiced Value">
                      {lineTotal > 0 ? formatTotal(amountRemaining) : '—'}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="text"
                      value={row.drawingReference}
                      onChange={(e) => updateRow(row.id, 'drawingReference', e.target.value)}
                      placeholder="Optional"
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="text"
                      value={row.specificationReference}
                      onChange={(e) => updateRow(row.id, 'specificationReference', e.target.value)}
                      placeholder="Optional"
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-14 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= 1}
                      title={rows.length <= 1 ? 'At least one BOQ row is required' : 'Remove row'}
                      className="text-text-muted hover:text-danger focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-text-muted"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add Item
        </button>
        <div className="text-right rounded-md border border-accent/20 bg-accent/5 px-5 py-2.5">
          <p className="text-xs text-text-muted">Total Amount (KWD)</p>
          <p className="text-lg font-bold tabular-nums text-text-primary">{formatTotal(totalAmount)}</p>
        </div>
      </div>
    </div>
  );
}
