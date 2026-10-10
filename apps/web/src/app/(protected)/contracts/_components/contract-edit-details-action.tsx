'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { updateContractBasicDetailsAction } from '../actions';
import type { Contract } from '../../../../lib/contracts-api';
import { SCHEDULE_STATUS_OPTIONS } from '../_lib/contract-ui-helpers';
import { PaymentTermsEditor } from './payment-terms-editor';
import {
  basicDetailsFromContract,
  validateBasicDetails,
  toBasicDetailsPayload,
  BASIC_DETAILS_SAVE_SUCCESS,
  type BasicDetailsForm,
} from '../_lib/contract-basic-details-helpers';

interface Props {
  contract: Contract;
}

const INPUT_CLS = 'mt-1 block w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

/**
 * FMP-CONTRACT-03 — "Edit Contract Details" on Contract Overview. A modal
 * (same overlay shape as ContractCancelAction) over the narrow
 * PATCH :id/basic-details endpoint. Intentionally has no BOQ, scope-flag,
 * value, workflow, payment or status inputs. Form values are kept on error;
 * the parent only renders this for contracts.manage on DRAFT/ACTIVE contracts.
 */
export function ContractEditDetailsAction({ contract }: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BasicDetailsForm>(() => basicDetailsFromContract(contract));
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openModal(): void {
    setForm(basicDetailsFromContract(contract));
    setErrors([]);
    setSuccess(false);
    setOpen(true);
  }

  function set<K extends keyof BasicDetailsForm>(key: K, value: BasicDetailsForm[K]): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save(): void {
    const problems = validateBasicDetails(form);
    setSuccess(false);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setErrors([]);
    startTransition(async () => {
      const result = await updateContractBasicDetailsAction(contract.id, toBasicDetailsPayload(form, contract.version));
      if (result.error) {
        setErrors([result.error]);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-secondary"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit Contract Details
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Edit Contract Details">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">Edit Contract Details</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              <p className="text-sm text-text-secondary">Update basic contract details. BOQ, workflow, payments and progress are not changed here.</p>
              {errors.length > 0 && (
                <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
                  {errors.map((e) => <p key={e}>{e}</p>)}
                </div>
              )}
              {success && (
                <div role="status" className="rounded-md border border-success bg-success-light px-4 py-3 text-sm text-success">
                  {BASIC_DETAILS_SAVE_SUCCESS}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-text-primary">
                  Job Order No <span className="text-error">*</span>
                  <input value={form.jobOrder} onChange={(e) => set('jobOrder', e.target.value)} maxLength={100} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary">
                  Quotation No
                  <input value={form.quotationNumber} onChange={(e) => set('quotationNumber', e.target.value)} maxLength={100} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary">
                  Project / Contract Name <span className="text-error">*</span>
                  <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={300} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary">
                  Project Number
                  <input value={form.projectNumber} onChange={(e) => set('projectNumber', e.target.value)} maxLength={100} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary sm:col-span-2">
                  Client / Employer <span className="text-error">*</span>
                  <input value={form.counterpartyName} onChange={(e) => set('counterpartyName', e.target.value)} maxLength={300} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary">
                  Contract Date
                  <input type="date" value={form.contractDate} onChange={(e) => set('contractDate', e.target.value)} className={INPUT_CLS} />
                </label>
                <span className="hidden sm:block" />
                <label className="block text-sm font-medium text-text-primary">
                  Schedule Start Date
                  <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary">
                  Schedule End Date
                  <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary sm:col-span-2">
                  Schedule Status
                  <select value={form.scheduleStatus} onChange={(e) => set('scheduleStatus', e.target.value)} className={INPUT_CLS}>
                    <option value="">Select schedule status</option>
                    {SCHEDULE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-text-primary sm:col-span-2">
                  Scope of Work (description)
                  <textarea rows={3} value={form.scopeDescription} onChange={(e) => set('scopeDescription', e.target.value)} className={INPUT_CLS} />
                </label>
                <label className="block text-sm font-medium text-text-primary sm:col-span-2">
                  Notes / Remarks
                  <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={INPUT_CLS} />
                </label>
<fieldset className="sm:col-span-2">
                  <legend className="text-sm font-medium text-text-primary mb-1">Payment Terms</legend>
                  <PaymentTermsEditor value={form.paymentTerms} onChange={(next) => set('paymentTerms', next)} />
                </fieldset>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-surface-secondary disabled:opacity-50"
              >
                {success ? 'Close' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
