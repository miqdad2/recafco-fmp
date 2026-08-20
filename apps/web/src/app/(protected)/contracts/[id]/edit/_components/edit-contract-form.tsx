'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { ActionResult } from '../../../actions';
import { ContractBoqTable } from '../../../_components/contract-boq-table';
import {
  InfoBox,
  inputCls,
  labelCls,
  gridCls3,
  ClientContactFields,
  ContractDatesFields,
  ProjectSiteFields,
  ScopeOfWorkFieldset,
  CraneFields,
} from '../../../_components/contract-form-fields';
import { PAYMENT_TERM_OPTIONS, formatContractValue } from '../../../_lib/contract-ui-helpers';
import {
  type BoqRow,
  type ExistingBoqItem,
  emptyBoqRow,
  boqRowsFromExisting,
  boqLineTotal,
  validateBoqRows,
  toBoqApiItems,
} from '../../../_lib/contract-boq-helpers';

interface OrgItem {
  id: string;
  code: string;
  name: string;
}

interface PersonItem {
  id: string;
  displayName: string;
}

interface DefaultValues {
  title: string;
  counterpartyName: string;
  description?: string;
  counterpartyContact?: string;
  jobOrder?: string;
  contractDate?: string;
  quotationNumber?: string;
  projectNumber?: string;
  scopeOfWork?: Record<string, boolean | string>;
  paymentTerms?: Record<string, boolean>;
  boqItems?: ExistingBoqItem[];
  contractValue?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  renewalNoticeDate?: string;
  clientContactName?: string;
  clientContactPhone?: string;
  forecastCompletionDate?: string;
  originalContractValue?: string;
  originalCurrency?: string;
  projectSiteLocation?: string;
  scopeDescription?: string;
  scopeExclusions?: string;
  deliverables?: string;
  milestones?: string;
  scheduleSummary?: string;
  quantitiesSpecifications?: string;
  craneRequired?: string;
  craneProvidedBy?: string;
  estimatedCraneCapacity?: string;
  ownerUserId?: string;
  departmentId?: string;
  plantId?: string;
  notes?: string;
}

interface Props {
  contractId: string;
  boundAction: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  depts: OrgItem[];
  plantsData: OrgItem[];
  people: PersonItem[];
  defaultValues: DefaultValues;
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold text-text-primary mb-5">{title}</h2>
      {children}
    </div>
  );
}

function formatKwd(amount: number): string {
  return formatContractValue(amount.toString(), 'KWD');
}

export function EditContractForm({
  contractId,
  boundAction,
  depts,
  plantsData,
  people,
  defaultValues,
}: Props): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    boundAction,
    { error: null },
  );

  const initialScope = defaultValues.scopeOfWork ?? {};
  const initialScopeBooleans: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(initialScope)) {
    if (typeof v === 'boolean') initialScopeBooleans[k] = v;
  }
  const [exFactory, setExFactory] = useState(initialScope['exFactory'] === true);
  const [scope, setScope] = useState<Record<string, boolean>>(initialScopeBooleans);
  const [otherDescription, setOtherDescription] = useState(
    typeof initialScope['otherDescription'] === 'string' ? initialScope['otherDescription'] : '',
  );
  const [boqRows, setBoqRows] = useState<BoqRow[]>(() =>
    defaultValues.boqItems && defaultValues.boqItems.length > 0 ? boqRowsFromExisting(defaultValues.boqItems) : [],
  );
  const [boqError, setBoqError] = useState<string | null>(null);

  const erectionSelected = !exFactory && scope['erection'] === true && scope['notApplicable'] !== true;

  const totalAmount = boqRows.reduce((sum, row) => sum + boqLineTotal(row), 0);
  const boqItemsPayload = toBoqApiItems(boqRows);
  const hasBoqRows = boqItemsPayload.length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    const validationError = validateBoqRows(boqRows);
    setBoqError(validationError);
    if (validationError) {
      e.preventDefault();
    }
  }

  const errorBanner = (state.error || boqError) && (
    <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
      {boqError ?? state.error}
    </div>
  );

  return (
    <>
      {errorBanner}

      <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Contract Details */}
        <SectionCard title="Basic Contract Details">
          <div className={gridCls3}>
            <div>
              <label htmlFor="jobOrder" className={labelCls}>Job Order</label>
              <input
                id="jobOrder"
                name="jobOrder"
                type="text"
                maxLength={100}
                defaultValue={defaultValues.jobOrder ?? ''}
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
                defaultValue={defaultValues.contractDate ?? ''}
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
                defaultValue={defaultValues.quotationNumber ?? ''}
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
                defaultValue={defaultValues.counterpartyName}
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
                defaultValue={defaultValues.title}
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
                defaultValue={defaultValues.projectNumber ?? ''}
                placeholder="Enter project number"
                className={inputCls}
              />
            </div>
          </div>
        </SectionCard>

        {/* Client Contact */}
        <SectionCard title="Client Contact">
          <ClientContactFields defaults={defaultValues} />
        </SectionCard>

        {/* Contract Dates */}
        <SectionCard title="Contract Dates">
          <ContractDatesFields defaults={defaultValues} />
        </SectionCard>

        {/* Project / Site Details */}
        <SectionCard title="Project / Site Details">
          <ProjectSiteFields defaults={defaultValues} />
        </SectionCard>

        {/* Scope of Work */}
        <SectionCard title="Scope of Work">
          <ScopeOfWorkFieldset
            scope={scope}
            onScopeChange={setScope}
            exFactory={exFactory}
            onExFactoryChange={setExFactory}
            otherDescription={otherDescription}
            onOtherDescriptionChange={setOtherDescription}
          />
        </SectionCard>

        {/* Payment Terms */}
        <SectionCard title="Payment Terms">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PAYMENT_TERM_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary text-center cursor-pointer transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/5 hover:border-border-strong"
              >
                <input
                  type="checkbox"
                  name={`paymentTerm_${opt.key}`}
                  defaultChecked={defaultValues.paymentTerms?.[opt.key] === true}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Erection / Crane Information (only when Erection is selected) */}
        {erectionSelected && (
          <SectionCard title="Erection / Crane Information">
            <CraneFields defaults={defaultValues} />
          </SectionCard>
        )}

        {/* BOQ / Contract Items */}
        <SectionCard title="BOQ / Contract Items">
          {boqRows.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">No BOQ items yet.</p>
              <button
                type="button"
                onClick={() => setBoqRows([emptyBoqRow()])}
                className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Add BOQ Item
              </button>
            </div>
          ) : (
            <ContractBoqTable rows={boqRows} onRowsChange={setBoqRows} formatTotal={formatKwd} />
          )}

          {/* Contract Value: computed from BOQ when rows exist, manual entry when empty */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {hasBoqRows ? (
              <div className="sm:col-span-2 text-right">
                <p className="text-xs text-text-muted">Current Contract Value (from BOQ)</p>
                <p className="text-sm font-semibold text-text-primary">{formatKwd(totalAmount)}</p>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="contractValue" className={labelCls}>Current Contract Value</label>
                  <input
                    id="contractValue"
                    name="contractValue"
                    type="number"
                    step="0.001"
                    min="0"
                    defaultValue={defaultValues.contractValue ?? ''}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="currency" className={labelCls}>Currency</label>
                  <input
                    id="currency"
                    name="currency"
                    type="text"
                    maxLength={10}
                    defaultValue={defaultValues.currency ?? ''}
                    className={inputCls}
                  />
                </div>
              </>
            )}
          </div>

          <input type="hidden" name="boqItems" value={JSON.stringify(boqItemsPayload)} />

          <div className="mt-4">
            <InfoBox>
              {hasBoqRows
                ? 'Current Contract Value is calculated automatically from the BOQ items above.'
                : 'Add a BOQ item to have Current Contract Value calculated automatically, or enter it manually.'}
            </InfoBox>
          </div>
        </SectionCard>

        {/* Original Value */}
        <SectionCard title="Original Contract Value">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="originalContractValue" className={labelCls}>Original Value</label>
              <input
                id="originalContractValue"
                name="originalContractValue"
                type="number"
                step="0.001"
                min="0"
                defaultValue={defaultValues.originalContractValue ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="originalCurrency" className={labelCls}>Currency</label>
              <input
                id="originalCurrency"
                name="originalCurrency"
                type="text"
                maxLength={3}
                placeholder="KWD"
                defaultValue={defaultValues.originalCurrency ?? ''}
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-4">
            <InfoBox>Current Contract Value is calculated from BOQ items when BOQ is entered.</InfoBox>
          </div>
        </SectionCard>

        {/* Additional Details */}
        <SectionCard title="Additional Details">
          <div className="space-y-6">
            <div>
              <label htmlFor="description" className={labelCls}>Description</label>
              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={10000}
                defaultValue={defaultValues.description ?? ''}
                className={`${inputCls} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="counterpartyContact" className={labelCls}>Counterparty Contact</label>
              <input
                id="counterpartyContact"
                name="counterpartyContact"
                type="text"
                maxLength={300}
                defaultValue={defaultValues.counterpartyContact ?? ''}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="renewalNoticeDate" className={labelCls}>Renewal Notice Date</label>
              <input
                id="renewalNoticeDate"
                name="renewalNoticeDate"
                type="date"
                defaultValue={defaultValues.renewalNoticeDate ?? ''}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="ownerUserId" className={labelCls}>Contract Owner</label>
              <select
                id="ownerUserId"
                name="ownerUserId"
                defaultValue={defaultValues.ownerUserId ?? ''}
                className={inputCls}
              >
                <option value="">— Select owner —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="departmentId" className={labelCls}>Department</label>
                <select
                  id="departmentId"
                  name="departmentId"
                  defaultValue={defaultValues.departmentId ?? ''}
                  className={inputCls}
                >
                  <option value="">— None —</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="plantId" className={labelCls}>Plant</label>
                <select
                  id="plantId"
                  name="plantId"
                  defaultValue={defaultValues.plantId ?? ''}
                  className={inputCls}
                >
                  <option value="">— None —</option>
                  {plantsData.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="notes" className={labelCls}>Notes</label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={10000}
                defaultValue={defaultValues.notes ?? ''}
                className={`${inputCls} resize-y`}
              />
            </div>
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/contracts/${contractId}`}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
