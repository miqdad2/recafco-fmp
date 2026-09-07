'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  type BoqRow,
  boqLineTotal,
  emptyBoqRow,
  UNIT_OF_MEASURE_OPTIONS,
  MIX_DESIGN_OPTIONS,
} from '../_lib/contract-boq-helpers';

const BOQ_COLUMNS = [
  'S/N', 'Item/Code', 'Category', 'Description', 'Drawing Ref.', 'Specification Ref.',
  'Original Estimated Qty', 'Revised Qty', 'Unit', 'Mix Design', 'Concrete Grade',
  'Unit Price', 'Total Price', 'Action',
];

const boqInputCls =
  'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

interface Props {
  rows: BoqRow[];
  onRowsChange: (rows: BoqRow[]) => void;
  formatTotal: (amount: number) => string;
}

export function ContractBoqTable({ rows, onRowsChange, formatTotal }: Props): React.JSX.Element {
  function updateRow(id: string, field: keyof Omit<BoqRow, 'id'>, value: string): void {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow(): void {
    onRowsChange([...rows, emptyBoqRow()]);
  }

  function removeRow(id: string): void {
    onRowsChange(rows.filter((r) => r.id !== id));
  }

  const totalAmount = rows.reduce((sum, row) => sum + boqLineTotal(row), 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[1400px] divide-y divide-border text-xs">
          <thead className="border-b-2 border-border-strong">
            <tr className="bg-surface-secondary">
              {BOQ_COLUMNS.map((col) => (
                <th key={col} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {rows.map((row, index) => {
              const lineTotal = boqLineTotal(row);
              return (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-text-muted">{index + 1}</td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="text"
                      value={row.itemCode}
                      onChange={(e) => updateRow(row.id, 'itemCode', e.target.value)}
                      placeholder="e.g. PC-001"
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-28">
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 min-w-[240px]">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                      placeholder="Item description"
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-28">
                    <input
                      type="text"
                      value={row.drawingReference}
                      onChange={(e) => updateRow(row.id, 'drawingReference', e.target.value)}
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-28">
                    <input
                      type="text"
                      value={row.specificationReference}
                      onChange={(e) => updateRow(row.id, 'specificationReference', e.target.value)}
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.originalEstimatedQty}
                      onChange={(e) => updateRow(row.id, 'originalEstimatedQty', e.target.value)}
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.revisedQty}
                      onChange={(e) => updateRow(row.id, 'revisedQty', e.target.value)}
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-20">
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
                  <td className="px-3 py-1.5 w-28">
                    <select
                      value={row.mixDesignType}
                      onChange={(e) => updateRow(row.id, 'mixDesignType', e.target.value)}
                      className={boqInputCls}
                    >
                      <option value="">—</option>
                      {MIX_DESIGN_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 w-28">
                    <input
                      type="text"
                      value={row.concreteGrade}
                      onChange={(e) => updateRow(row.id, 'concreteGrade', e.target.value)}
                      placeholder="e.g. C40"
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-28">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(row.id, 'unitPrice', e.target.value)}
                      className={boqInputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-28 text-text-secondary font-medium whitespace-nowrap">
                    {lineTotal > 0 ? formatTotal(lineTotal) : '—'}
                  </td>
                  <td className="px-3 py-2 w-14 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-text-muted hover:text-error focus:outline-none focus:ring-2 focus:ring-focus rounded"
                      title="Remove row"
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
        <div className="text-right rounded-md border border-border bg-surface-secondary px-4 py-2">
          <p className="text-xs text-text-muted">Total Amount</p>
          <p className="text-base font-semibold text-text-primary">{formatTotal(totalAmount)}</p>
        </div>
      </div>
    </div>
  );
}
