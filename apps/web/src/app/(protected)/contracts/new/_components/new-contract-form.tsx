'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { HandCoins, Shield, ShieldCheck, Umbrella, Receipt, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { createContractAction } from '../../actions';
import { ContractBoqRegisterTable } from '../../_components/contract-boq-register-table';
import {
  InfoBox,
  inputCls,
  labelCls,
  gridCls3,
  ScopeOfWorkFieldset,
  ContractDatesFields,
  ContractValueFields,
} from '../../_components/contract-form-fields';
import { PAYMENT_TERM_OPTIONS, formatContractValue } from '../../_lib/contract-ui-helpers';
import {
  type BoqRow,
  emptyRegisterBoqRow,
  boqLineTotal,
  validateBoqRows,
  toBoqApiItems,
} from '../../_lib/contract-boq-helpers';

interface Props {
  /** Current user's Contract Management department-access scope, used to explain department assignment on create. */
  scope?: { type: 'OWN_DEPARTMENT' | 'SELECTED_DEPARTMENTS' | 'ALL_DEPARTMENTS'; departmentNames: string[] } | undefined;
}

// CM-56 — the New Contract Register form has its own <form id> so the page
// header's top Cancel/Save Draft buttons (apps/web/.../new/page.tsx,
// outside this client component) can submit/cancel via the standard HTML
// `form` attribute — no cross-component state sharing needed, no fake
// buttons: the top Save Draft really submits this exact form.
export const NEW_CONTRACT_FORM_ID = 'new-contract-register-form';

// CM-56 — Scope of Work options this register omits entirely, matching the
// approved design's 5-option scope section (Shop Drawing / Production /
// Delivery / Erection / Ex-Factory only). ScopeOfWorkFieldset is shared with
// Edit Contract, which passes no excludeKeys and is completely unaffected —
// an existing contract's Design Production flag (if ever set) stays fully
// visible/editable there.
const NEW_REGISTER_EXCLUDED_SCOPE_KEYS = ['designProduction', 'other', 'notApplicable'];

const PAYMENT_TERM_ICONS: Record<string, LucideIcon> = {
  advance: HandCoins,
  retention: Shield,
  performanceBond: ShieldCheck,
  insurance: Umbrella,
  interimPayment: Receipt,
  taxClearance: Landmark,
};

function SectionCard({ badge, title, children }: { badge: string; title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-semibold">
          {badge}
        </span>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// CM-56B — approved-design 2-column checkbox grid for Scope of Work's
// narrower ~40% column (the shared `gridCls3` used everywhere else is
// 3-column, sized for a full-width card — too cramped/wide here).
const SCOPE_GRID_CLS = 'grid grid-cols-2 gap-3';

function formatKwd(amount: number): string {
  return formatContractValue(amount.toString(), 'KWD');
}

const INITIAL_BOQ_ROW_COUNT = 5;

export function NewContractForm({ scope: deptScope }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createContractAction,
    { error: null },
  );
  const [exFactory, setExFactory] = useState(false);
  const [scope, setScope] = useState<Record<string, boolean>>({});
  const [otherDescription, setOtherDescription] = useState('');
  const [boqRows, setBoqRows] = useState<BoqRow[]>(() => Array.from({ length: INITIAL_BOQ_ROW_COUNT }, () => emptyRegisterBoqRow()));
  const [boqError, setBoqError] = useState<string | null>(null);
  // Save Draft and Register Contract submit the same <form> to the same
  // createContractAction — there is no separate draft/register backend status
  // (ContractsService.create() always writes ContractStatus.DRAFT), so both
  // buttons produce an identical Draft contract today. clickedAction only
  // drives which button shows its own pending label; it has no effect on
  // what gets submitted. The footer note below says this plainly.
  const [clickedAction, setClickedAction] = useState<'save' | 'create' | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    const validationError = validateBoqRows(boqRows);
    setBoqError(validationError);
    if (validationError) {
      e.preventDefault();
    }
  }

  const totalAmount = boqRows.reduce((sum, row) => sum + boqLineTotal(row), 0);
  const boqItemsPayload = toBoqApiItems(boqRows);

  const errorBanner = (state.error || boqError) && (
    <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
      {boqError ?? state.error}
    </div>
  );

  const ownDepartmentName = deptScope?.departmentNames[0];
  const departmentBanner =
    deptScope?.type === 'OWN_DEPARTMENT' ? (
      ownDepartmentName ? (
        <InfoBox variant="subtle">This contract will be created under your department.</InfoBox>
      ) : (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Your user is not assigned to a department. Please contact administrator.
        </div>
      )
    ) : null;

  return (
    <>
      {errorBanner && <div className="mb-6">{errorBanner}</div>}
      {departmentBanner && <div className="mb-6">{departmentBanner}</div>}

      <form id={NEW_CONTRACT_FORM_ID} action={formAction} onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1 — Basic Contract Details (~60%) and Scope of Work (~40%) side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
          {/* Section 1 — Basic Contract Details */}
          <SectionCard badge="1" title="Basic Contract Details">
            <div className={gridCls3}>
              <div>
                <label htmlFor="jobOrder" className={labelCls}>Job Order</label>
                <input id="jobOrder" name="jobOrder" type="text" maxLength={100} placeholder="Enter job order" className={inputCls} />
              </div>

              <div>
                <label htmlFor="contractDate" className={labelCls}>Date</label>
                <input id="contractDate" name="contractDate" type="date" className={inputCls} />
              </div>

              <div>
                <label htmlFor="quotationNumber" className={labelCls}>Quotation #</label>
                <input id="quotationNumber" name="quotationNumber" type="text" maxLength={100} placeholder="Enter quotation number" className={inputCls} />
              </div>

              <div>
                <label htmlFor="counterpartyName" className={labelCls}>
                  Company Name <span className="text-error">*</span>
                </label>
                <input
                  id="counterpartyName" name="counterpartyName" type="text" required maxLength={300}
                  placeholder="Enter company name" className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="title" className={labelCls}>
                  Project Name <span className="text-error">*</span>
                </label>
                <input id="title" name="title" type="text" required maxLength={300} placeholder="Enter project name" className={inputCls} />
              </div>

              <div>
                <label htmlFor="projectNumber" className={labelCls}>Project Number</label>
                <input id="projectNumber" name="projectNumber" type="text" maxLength={100} placeholder="Enter project number" className={inputCls} />
              </div>
            </div>
          </SectionCard>

          {/* Section 2 — Scope of Work */}
          <SectionCard badge="2" title="Scope of Work">
            <ScopeOfWorkFieldset
              scope={scope}
              onScopeChange={setScope}
              exFactory={exFactory}
              onExFactoryChange={setExFactory}
              otherDescription={otherDescription}
              onOtherDescriptionChange={setOtherDescription}
              excludeKeys={NEW_REGISTER_EXCLUDED_SCOPE_KEYS}
              gridClassName={SCOPE_GRID_CLS}
              infoBoxVariant="subtle"
            />
          </SectionCard>
        </div>

        {/* Row 2 — Contract Dates (left) and Contract Value (right) side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Section 3 — Contract Dates */}
          <SectionCard badge="3" title="Contract Dates">
            <ContractDatesFields />
          </SectionCard>

          {/* Section 4 — Contract Value */}
          <SectionCard badge="4" title="Contract Value">
            <ContractValueFields defaults={{ originalCurrency: 'KWD' }} />
          </SectionCard>
        </div>

        {/* Section 5 — Payment Terms */}
        <SectionCard badge="5" title="Payment Terms">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {PAYMENT_TERM_OPTIONS.map((opt) => {
              const Icon = PAYMENT_TERM_ICONS[opt.key];
              return (
                <label
                  key={opt.key}
                  className="flex items-center justify-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-5 text-sm font-medium text-text-primary text-center cursor-pointer transition-colors has-checked:border-accent has-checked:bg-accent/5 hover:border-border-strong"
                >
                  <input
                    type="checkbox"
                    name={`paymentTerm_${opt.key}`}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  {Icon && <Icon className="size-5 text-text-secondary shrink-0" aria-hidden="true" />}
                  {opt.label}
                </label>
              );
            })}
          </div>
        </SectionCard>

        {/* Section 6 — Contract BOQ / Items */}
        <SectionCard badge="6" title="Contract BOQ / Items">
          <ContractBoqRegisterTable rows={boqRows} onRowsChange={setBoqRows} formatTotal={formatKwd} />

          <div className="mt-3">
            <InfoBox variant="subtle">
              BOQ Qty / Area is the original contract quantity. Drawing Qty can be updated when drawing/calculation
              quantity is confirmed. Progress / Invoice % is calculated from Invoice Qty against BOQ Qty / Area.
            </InfoBox>
          </div>

          <input type="hidden" name="contractValue" value={totalAmount > 0 ? totalAmount.toFixed(3) : ''} />
          <input type="hidden" name="currency" value={totalAmount > 0 ? 'KWD' : ''} />
          <input type="hidden" name="boqItems" value={boqItemsPayload.length > 0 ? JSON.stringify(boqItemsPayload) : ''} />
        </SectionCard>

        {/* Section 7 — Actions */}
        <SectionCard badge="7" title="Actions">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <InfoBox variant="subtle">
              Register Contract saves the contract in the list as Draft. Use Activate Contract from the
              contract page once all terms are confirmed and it is ready to move forward.
            </InfoBox>
            <div className="shrink-0 flex items-center justify-end gap-3">
              <Link
                href="/contracts"
                className="inline-flex items-center h-11 px-5 rounded-md border border-border bg-surface text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Cancel
              </Link>
              <button
                type="submit"
                onClick={() => setClickedAction('save')}
                disabled={isPending}
                className="inline-flex items-center h-11 px-5 rounded-md border border-accent/30 bg-accent/5 text-sm font-medium text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
              >
                {isPending && clickedAction === 'save' ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="submit"
                onClick={() => setClickedAction('create')}
                disabled={isPending}
                className="inline-flex items-center h-11 px-5 rounded-md bg-success text-sm font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
              >
                {isPending && clickedAction === 'create' ? 'Registering…' : 'Register Contract'}
              </button>
            </div>
          </div>
        </SectionCard>
      </form>
    </>
  );
}
