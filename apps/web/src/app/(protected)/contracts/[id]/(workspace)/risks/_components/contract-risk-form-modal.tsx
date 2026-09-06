'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../../../actions';
import { createRiskAction, updateRiskAction } from '../../../../actions';
import type { ContractRisk, ContractPerson } from '@/lib/contracts-api';
import { inputCls, labelCls, InfoBox } from '../../../../_components/contract-form-fields';
import { RISK_LEVEL_OPTIONS, RISK_RESPONSE_OPTIONS, RISK_STATUS_OPTIONS } from '../../../../_lib/contract-risk-helpers';

interface Props {
  contractId: string;
  mode: 'add' | 'edit';
  risk?: ContractRisk;
  people: ContractPerson[];
  onClose: () => void;
}

/**
 * CM-62 — Add / Edit Risk modal. Risk Clause / Description is the only
 * required field. Risk Response is exactly the 4 manager-clarified options
 * (Mitigate/Accept/Avoid/Transfer) — Subcontracting/Insurance belong only in
 * the free-text Risk Response Description below it, never as a dropdown
 * value. Residual Risk is a plain manual dropdown with its own helper text
 * — it is never derived from Risk Evaluation or Risk Response, so leaving
 * it unset on Add is expected and honest (shows "—" in the table, and is
 * excluded from the Average Residual Risk KPI, not treated as a fabricated
 * "Low").
 */
export function ContractRiskFormModal({ contractId, mode, risk, people, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const action = mode === 'edit' && risk ? updateRiskAction.bind(null, risk.id, contractId) : createRiskAction.bind(null, contractId);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && !state.error) {
      submittedRef.current = false;
      onClose();
      router.refresh();
    }
  }, [state, isPending, onClose, router]);

  function handleSubmit(): void {
    submittedRef.current = true;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,680px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <h2 id="risk-form-title" className="text-lg font-semibold text-text-primary">
            {mode === 'add' ? 'Add Risk' : 'Edit Risk'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form id="risk-form" action={formAction} onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {state.error && (
            <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="riskNo" className={labelCls}>Risk ID</label>
              <input
                id="riskNo"
                name="riskNo"
                type="text"
                maxLength={50}
                defaultValue={risk?.riskNo ?? ''}
                placeholder="e.g. RISK-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>Status</label>
              <select id="status" name="status" defaultValue={risk?.status ?? 'OPEN'} className={inputCls}>
                {RISK_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className={labelCls}>
              Risk Clause / Description <span className="text-danger">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={2}
              maxLength={500}
              defaultValue={risk?.description ?? ''}
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="riskEvaluation" className={labelCls}>Risk Evaluation</label>
              <select id="riskEvaluation" name="riskEvaluation" defaultValue={risk?.riskEvaluation ?? ''} className={inputCls}>
                <option value="">— Select —</option>
                {RISK_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="riskResponse" className={labelCls}>Risk Response</label>
              <select id="riskResponse" name="riskResponse" defaultValue={risk?.riskResponse ?? ''} className={inputCls}>
                <option value="">— Select —</option>
                {RISK_RESPONSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="riskResponseDescription" className={labelCls}>Risk Response Description</label>
            <textarea
              id="riskResponseDescription"
              name="riskResponseDescription"
              rows={2}
              maxLength={2000}
              defaultValue={risk?.riskResponseDescription ?? ''}
              placeholder="e.g. Cover through insurance and subcontractor responsibility clause."
              className={`${inputCls} resize-y`}
            />
          </div>

          <div>
            <label htmlFor="residualRisk" className={labelCls}>Residual Risk</label>
            <select id="residualRisk" name="residualRisk" defaultValue={risk?.residualRisk ?? ''} className={inputCls}>
              <option value="">— Select —</option>
              {RISK_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-muted">Select the expected risk level after the response action.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="responsibleUserId" className={labelCls}>Responsible Person</label>
              <select id="responsibleUserId" name="responsibleUserId" defaultValue={risk?.responsibleUserId ?? ''} className={inputCls}>
                <option value="">— Unassigned —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="actionDueDate" className={labelCls}>Action Due Date</label>
              <input
                id="actionDueDate"
                name="actionDueDate"
                type="date"
                defaultValue={risk?.actionDueDate ?? ''}
                className={inputCls}
              />
            </div>
          </div>

          <InfoBox variant="subtle">
            Action Due Date is when the Responsible Person should complete the risk response action.
          </InfoBox>

          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              maxLength={5000}
              defaultValue={risk?.remarks ?? ''}
              className={`${inputCls} resize-y`}
            />
          </div>
        </form>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="risk-form"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : mode === 'add' ? 'Add Risk' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
