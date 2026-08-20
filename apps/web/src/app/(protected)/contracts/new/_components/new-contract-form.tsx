'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { ActionResult } from '../../actions';
import { createContractAction } from '../../actions';
import { ContractBoqTable } from '../../_components/contract-boq-table';
import {
  InfoBox,
  inputCls,
  labelCls,
  gridCls3,
  ClientContactFields,
  ContractDatesFields,
  ContractValueFields,
  ProjectSiteFields,
  ScopeOfWorkFieldset,
  CraneFields,
} from '../../_components/contract-form-fields';
import { PAYMENT_TERM_OPTIONS, formatContractValue } from '../../_lib/contract-ui-helpers';
import {
  type BoqRow,
  emptyBoqRow,
  boqLineTotal,
  validateBoqRows,
  toBoqApiItems,
} from '../../_lib/contract-boq-helpers';

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
    <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-semibold">
          {badge}
        </span>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function formatKwd(amount: number): string {
  return formatContractValue(amount.toString(), 'KWD');
}

export function NewContractForm({ scope: deptScope, onCancel, layout = 'page' }: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    createContractAction,
    { error: null },
  );
  const [exFactory, setExFactory] = useState(false);
  const [scope, setScope] = useState<Record<string, boolean>>({});
  const [otherDescription, setOtherDescription] = useState('');
  const [boqRows, setBoqRows] = useState<BoqRow[]>(() => [emptyBoqRow()]);
  const [boqError, setBoqError] = useState<string | null>(null);
  // Save Draft and Create Draft Contract submit the same <form> to the same
  // createContractAction — there is no separate draft/register backend status
  // (ContractsService.create() always writes ContractStatus.DRAFT), so both
  // buttons produce an identical Draft contract today. clickedAction only
  // drives which button shows its own pending label; it has no effect on
  // what gets submitted.
  const [clickedAction, setClickedAction] = useState<'save' | 'create' | null>(null);

  const erectionSelected = !exFactory && scope['erection'] === true && scope['notApplicable'] !== true;

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
    <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
      {boqError ?? state.error}
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
        type="submit"
        onClick={() => setClickedAction('save')}
        disabled={isPending}
        className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
      >
        {isPending && clickedAction === 'save' ? 'Saving…' : 'Save Draft'}
      </button>
      <button
        type="submit"
        onClick={() => setClickedAction('create')}
        disabled={isPending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
      >
        {isPending && clickedAction === 'create' ? 'Creating…' : 'Create Draft Contract'}
      </button>
    </div>
  );

  const footerNote = (
    <InfoBox>
      Save Draft or Create Draft Contract will keep the contract in Draft status. Use Activate Contract from
      the contract page when the contract is ready.
    </InfoBox>
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

      {/* Section 2 — Client Contact */}
      <SectionCard badge="2" title="Client Contact">
        <ClientContactFields />
      </SectionCard>

      {/* Section 3 — Contract Dates */}
      <SectionCard badge="3" title="Contract Dates">
        <ContractDatesFields />
      </SectionCard>

      {/* Section 4 — Contract Value */}
      <SectionCard badge="4" title="Contract Value">
        <ContractValueFields />
      </SectionCard>

      {/* Section 5 — Project / Site Details */}
      <SectionCard badge="5" title="Project / Site Details">
        <ProjectSiteFields />
      </SectionCard>

      {/* Section 6 — Scope of Work */}
      <SectionCard badge="6" title="Scope of Work">
        <ScopeOfWorkFieldset
          scope={scope}
          onScopeChange={setScope}
          exFactory={exFactory}
          onExFactoryChange={setExFactory}
          otherDescription={otherDescription}
          onOtherDescriptionChange={setOtherDescription}
        />
      </SectionCard>

      {/* Section 7 — Payment Terms */}
      <SectionCard badge="7" title="Payment Terms">
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

      {/* Section 8 — Erection / Crane Information (only when Erection is selected) */}
      {erectionSelected && (
        <SectionCard badge="8" title="Erection / Crane Information">
          <CraneFields />
        </SectionCard>
      )}

      {/* Section 9 — Contract BOQ / Items */}
      <SectionCard badge="9" title="Contract BOQ / Items">
        <ContractBoqTable rows={boqRows} onRowsChange={setBoqRows} formatTotal={formatKwd} />

        <div className="mt-4">
          <InfoBox>
            Basic details, scope, payment terms, BOQ line items, and total amount will all be saved to the
            contract record.
          </InfoBox>
        </div>

        <input type="hidden" name="contractValue" value={totalAmount > 0 ? totalAmount.toFixed(3) : ''} />
        <input type="hidden" name="currency" value={totalAmount > 0 ? 'KWD' : ''} />
        <input type="hidden" name="boqItems" value={boqItemsPayload.length > 0 ? JSON.stringify(boqItemsPayload) : ''} />
      </SectionCard>

      {/* Section 10 — Actions (page layout only; modal layout uses a sticky footer instead) */}
      {layout === 'page' && (
        <SectionCard badge="10" title="Actions">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            {footerNote}
            <div className="shrink-0">{actions}</div>
          </div>
        </SectionCard>
      )}
    </>
  );

  if (layout === 'modal') {
    return (
      <form action={formAction} onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6 space-y-5">
          {errorBanner}
          {departmentBanner}
          {sections}
        </div>
        <div className="shrink-0 border-t border-border bg-surface px-6 sm:px-8 py-4 space-y-3">
          {errorBanner}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            {footerNote}
            <div className="shrink-0">{actions}</div>
          </div>
        </div>
      </form>
    );
  }

  return (
    <>
      {errorBanner && <div className="mb-6">{errorBanner}</div>}
      {departmentBanner && <div className="mb-6">{departmentBanner}</div>}
      <form action={formAction} onSubmit={handleSubmit} className="space-y-5">
        {sections}
      </form>
    </>
  );
}
