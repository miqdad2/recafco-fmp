'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Info, Plus, Trash2 } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { createContractAction } from '../../actions';

interface OrgItem {
  id: string;
  code: string;
  name: string;
}

interface PersonItem {
  id: string;
  displayName: string;
}

interface LocationItem {
  id: string;
  name: string;
  code: string;
}

interface Props {
  depts: OrgItem[];
  plantsData: OrgItem[];
  locations?: LocationItem[];
  people: PersonItem[];
  /** Current user's Contract Management department-access scope, used to explain department assignment on create. */
  scope?: { type: 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS'; departmentNames: string[] } | undefined;
  /** When provided, Cancel calls this instead of navigating (used inside the modal). */
  onCancel?: () => void;
  /** 'modal' fills its container height with an internally scrolling body and a pinned footer. Defaults to 'page' (natural document flow, used by /contracts/new). */
  layout?: 'page' | 'modal';
}

function SectionCard({
  badge,
  title,
  children,
}: {
  badge: string;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-semibold">
          {badge}
        </span>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info-light px-3 py-2.5 text-xs text-info">
      <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const boqInputCls =
  'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-sm font-medium text-text-primary mb-1';
const gridCls3 = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

interface BoqRow {
  id: string;
  description: string;
  unit: string;
  qty: string;
  unitPrice: string;
  invoiceQty: string;
  pr: string;
  amountRemaining: string;
}

function makeBoqId(): string {
  return `boq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBoqRow(): BoqRow {
  return { id: makeBoqId(), description: '', unit: '', qty: '', unitPrice: '', invoiceQty: '', pr: '', amountRemaining: '' };
}

function boqLineTotal(row: BoqRow): number {
  const qty = parseFloat(row.qty);
  const unitPrice = parseFloat(row.unitPrice);
  if (isNaN(qty) || isNaN(unitPrice)) return 0;
  return qty * unitPrice;
}

const SCOPE_OPTIONS = [
  { key: 'shopDrawing', label: 'Shop Drawing' },
  { key: 'designProduction', label: 'Design Production' },
  { key: 'production', label: 'Production' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'erection', label: 'Erection' },
];

const PAYMENT_TERM_OPTIONS = [
  { key: 'advance', label: 'Advance' },
  { key: 'retention', label: 'Retention' },
  { key: 'performanceBond', label: 'Performance Bond' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'interimPayment', label: 'Interim Payment' },
  { key: 'taxClearance', label: 'Tax Clearance' },
];

const BOQ_COLUMNS = ['S/N', 'Item Description', 'Unit', 'Qty', 'U/P', 'T/P', 'Invoice Qty', 'P/R', 'Amount Remaining', 'Action'];

export function NewContractForm({ scope: deptScope, onCancel, layout = 'page' }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createContractAction,
    { error: null },
  );
  const [exFactory, setExFactory] = useState(false);
  const [scope, setScope] = useState<Record<string, boolean>>({});
  const [boqRows, setBoqRows] = useState<BoqRow[]>(() => [emptyBoqRow()]);

  function updateBoqRow(id: string, field: keyof Omit<BoqRow, 'id'>, value: string): void {
    setBoqRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addBoqRow(): void {
    setBoqRows((rows) => [...rows, emptyBoqRow()]);
  }

  function removeBoqRow(id: string): void {
    setBoqRows((rows) => rows.filter((r) => r.id !== id));
  }

  const totalAmount = boqRows.reduce((sum, row) => sum + boqLineTotal(row), 0);

  const errorBanner = state.error && (
    <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
      {state.error}
    </div>
  );

  const ownDepartmentName = deptScope?.departmentNames[0];
  const departmentBanner =
    deptScope?.type === 'OWN_DEPARTMENT' ? (
      ownDepartmentName ? (
        <InfoBox>This contract will be created under your department.</InfoBox>
      ) : (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          Your user is not assigned to a department. Please contact administrator.
        </div>
      )
    ) : null;

  const actions = (
    <div className="flex items-center justify-end gap-3">
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Cancel
        </button>
      ) : (
        <Link
          href="/contracts"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Cancel
        </Link>
      )}
      <button
        type="button"
        disabled
        title="Register Contract already saves this as a Draft — a separate save-draft step isn't needed yet"
        className="rounded-md border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-text-muted cursor-not-allowed"
      >
        Save Draft
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
      >
        {isPending ? 'Registering…' : 'Register Contract'}
      </button>
    </div>
  );

  const sections = (
    <>
      {/* Section 1 — Basic Contract Details */}
      <SectionCard badge="1" title="Basic Contract Details">
        <div className={gridCls3}>
          <div>
            <label htmlFor="jobOrder" className={labelCls}>Job Order</label>
            <input
              id="jobOrder"
              name="jobOrder"
              type="text"
              maxLength={100}
              placeholder="Enter job order number"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="contractDate" className={labelCls}>Date</label>
            <input
              id="contractDate"
              name="contractDate"
              type="date"
              placeholder="Select contract date"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="quotationNumber" className={labelCls}>Quotation #</label>
            <input
              id="quotationNumber"
              name="quotationNumber"
              type="text"
              maxLength={100}
              placeholder="Enter quotation number"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="counterpartyName" className={labelCls}>
              Company Name <span className="text-danger">*</span>
            </label>
            <input
              id="counterpartyName"
              name="counterpartyName"
              type="text"
              required
              maxLength={300}
              placeholder="Client, employer, vendor…"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="title" className={labelCls}>
              Project Name <span className="text-danger">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={300}
              placeholder="Project or contract name"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="projectNumber" className={labelCls}>Project Number</label>
            <input
              id="projectNumber"
              name="projectNumber"
              type="text"
              maxLength={100}
              placeholder="Enter project number"
              className={inputCls}
            />
          </div>
        </div>
      </SectionCard>

      {/* Section 2 — Scope of Work */}
      <SectionCard badge="2" title="Scope of Work">
        <div className="space-y-4">
          <div className={gridCls3}>
            {SCOPE_OPTIONS.map((opt) => {
              const disabled = exFactory && (opt.key === 'delivery' || opt.key === 'erection');
              return (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-secondary' : 'text-text-primary'}`}
                >
                  <input
                    type="checkbox"
                    name={`scope_${opt.key}`}
                    disabled={disabled}
                    checked={disabled ? false : (scope[opt.key] ?? false)}
                    onChange={(e) => setScope((s) => ({ ...s, [opt.key]: e.target.checked }))}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  {opt.label}
                </label>
              );
            })}
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-secondary">
              <input
                type="checkbox"
                name="scope_exFactory"
                checked={exFactory}
                onChange={(e) => setExFactory(e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent"
              />
              Ex-Factory
            </label>
          </div>

          <InfoBox>If &ldquo;Ex-Factory&rdquo; is selected, Delivery and Erection will be disabled.</InfoBox>
        </div>
      </SectionCard>

      {/* Section 3 — Payment Terms */}
      <SectionCard badge="3" title="Payment Terms">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PAYMENT_TERM_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary text-center cursor-pointer transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5 hover:border-border-strong"
            >
              <input
                type="checkbox"
                name={`paymentTerm_${opt.key}`}
                className="rounded border-border text-accent focus:ring-accent"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </SectionCard>

      {/* Section 4 — Contract BOQ / Items */}
      <SectionCard badge="4" title="Contract BOQ / Items">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {BOQ_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {boqRows.map((row, index) => {
                const lineTotal = boqLineTotal(row);
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-text-muted">{index + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateBoqRow(row.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className={boqInputCls}
                      />
                    </td>
                    <td className="px-3 py-1.5 w-20">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => updateBoqRow(row.id, 'unit', e.target.value)}
                        className={boqInputCls}
                      />
                    </td>
                    <td className="px-3 py-1.5 w-20">
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) => updateBoqRow(row.id, 'qty', e.target.value)}
                        className={boqInputCls}
                      />
                    </td>
                    <td className="px-3 py-1.5 w-24">
                      <input
                        type="number"
                        value={row.unitPrice}
                        onChange={(e) => updateBoqRow(row.id, 'unitPrice', e.target.value)}
                        className={boqInputCls}
                      />
                    </td>
                    <td className="px-3 py-1.5 w-24 text-text-secondary font-medium">
                      {lineTotal > 0 ? lineTotal.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-1.5 w-24">
                      <input
                        type="number"
                        value={row.invoiceQty}
                        onChange={(e) => updateBoqRow(row.id, 'invoiceQty', e.target.value)}
                        className={boqInputCls}
                      />
                    </td>
                    <td className="px-3 py-1.5 w-20">
                      <input
                        type="text"
                        value={row.pr}
                        onChange={(e) => updateBoqRow(row.id, 'pr', e.target.value)}
                        className={boqInputCls}
                      />
                    </td>
                    <td className="px-3 py-1.5 w-28">
                      <input
                        type="text"
                        value={row.amountRemaining}
                        onChange={(e) => updateBoqRow(row.id, 'amountRemaining', e.target.value)}
                        className={boqInputCls}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeBoqRow(row.id)}
                        className="text-text-muted hover:text-danger focus:outline-none focus:ring-2 focus:ring-focus rounded"
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
            onClick={addBoqRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Item
          </button>
          <div className="text-right">
            <p className="text-xs text-text-muted">Total Amount (KWD)</p>
            <p className="text-sm font-semibold text-text-primary">{totalAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-4">
          <InfoBox>
            Basic details, scope, payment terms and total amount will be saved. BOQ line items will be saved in
            a later update.
          </InfoBox>
        </div>

        <input type="hidden" name="contractValue" value={totalAmount > 0 ? totalAmount.toFixed(2) : ''} />
        <input type="hidden" name="currency" value={totalAmount > 0 ? 'KWD' : ''} />
      </SectionCard>

      {/* Section 5 — Actions */}
      <SectionCard badge="5" title="Actions">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <InfoBox>
            Click &ldquo;Register Contract&rdquo; to save the contract and it will appear in the Contract List.
          </InfoBox>
          <div className="shrink-0">{actions}</div>
        </div>
      </SectionCard>
    </>
  );

  if (layout === 'modal') {
    return (
      <form action={formAction} className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-8 space-y-6">
          {errorBanner}
          {departmentBanner}
          {sections}
        </div>
      </form>
    );
  }

  return (
    <>
      {errorBanner && <div className="mb-6">{errorBanner}</div>}
      {departmentBanner && <div className="mb-6">{departmentBanner}</div>}
      <form action={formAction} className="space-y-6">
        {sections}
      </form>
    </>
  );
}
