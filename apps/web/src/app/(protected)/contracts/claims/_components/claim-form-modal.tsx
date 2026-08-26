'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { createClaimAction, updateClaimAction } from '../../actions';
import type { ContractClaim, ContractPerson } from '@/lib/contracts-api';
import { CONTRACT_CLAIM_TYPE_OPTIONS, CONTRACT_CLAIM_STATUS_OPTIONS } from '../../_lib/contract-ui-helpers';
import { inputCls, labelCls, gridCls3 } from '../../_components/contract-form-fields';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  mode: 'add' | 'edit';
  contracts?: ContractOption[];
  fixedContractId?: string;
  claim?: ContractClaim;
  people: ContractPerson[];
  onClose: () => void;
}

export function ClaimFormModal({ mode, contracts, fixedContractId, claim, people, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const contractId = fixedContractId ?? claim?.contractId;
  const action = mode === 'edit' && claim ? updateClaimAction.bind(null, claim.id, claim.contractId) : createClaimAction;
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
      aria-labelledby="claim-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,860px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <h2 id="claim-form-title" className="text-lg font-semibold text-text-primary">
            {mode === 'add' ? 'Add Claim' : 'Edit Claim'}
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

        <form id="claim-form" action={formAction} onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {state.error && (
            <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
              {state.error}
            </div>
          )}

          {mode === 'add' && !fixedContractId ? (
            <div>
              <label htmlFor="contractId" className={labelCls}>
                Contract <span className="text-danger">*</span>
              </label>
              <select id="contractId" name="contractId" required defaultValue="" className={inputCls}>
                <option value="" disabled>Select a contract…</option>
                {contracts?.map((c) => (
                  <option key={c.id} value={c.id}>{c.referenceNumber} — {c.title}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <input type="hidden" name="contractId" value={contractId ?? ''} />
              {mode === 'add' && (
                <div>
                  <span className={labelCls}>Contract</span>
                  <p className="text-sm text-text-primary">
                    {contracts?.find((c) => c.id === fixedContractId)?.referenceNumber ?? fixedContractId}
                  </p>
                </div>
              )}
              {mode === 'edit' && (
                <div>
                  <span className={labelCls}>Contract</span>
                  <p className="text-sm text-text-primary">
                    {claim?.contract.referenceNumber} — {claim?.contract.title}
                  </p>
                </div>
              )}
            </>
          )}

          <div>
            <label htmlFor="claimTitle" className={labelCls}>
              Claim Title <span className="text-danger">*</span>
            </label>
            <input
              id="claimTitle"
              name="claimTitle"
              type="text"
              required
              maxLength={300}
              defaultValue={claim?.claimTitle ?? ''}
              placeholder="Short description of the claim"
              className={inputCls}
            />
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="claimNo" className={labelCls}>Claim No.</label>
              <input
                id="claimNo"
                name="claimNo"
                type="text"
                maxLength={50}
                defaultValue={claim?.claimNo ?? ''}
                placeholder="e.g. CLM-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="claimType" className={labelCls}>Claim Type</label>
              <select id="claimType" name="claimType" defaultValue={claim?.claimType ?? 'OTHER'} className={inputCls}>
                {CONTRACT_CLAIM_TYPE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>Status</label>
              <select id="status" name="status" defaultValue={claim?.status ?? 'DRAFT'} className={inputCls}>
                {CONTRACT_CLAIM_STATUS_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="submittedValue" className={labelCls}>Submitted Value</label>
              <input
                id="submittedValue"
                name="submittedValue"
                type="number"
                step="0.001"
                min="0"
                defaultValue={claim?.submittedValue ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="approvedValue" className={labelCls}>Approved Value</label>
              <input
                id="approvedValue"
                name="approvedValue"
                type="number"
                step="0.001"
                min="0"
                defaultValue={claim?.approvedValue ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="responsibleUserId" className={labelCls}>Responsible Person</label>
              <select id="responsibleUserId" name="responsibleUserId" defaultValue={claim?.responsibleUserId ?? ''} className={inputCls}>
                <option value="">— Unassigned —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="eotClaimedDays" className={labelCls}>EOT Claimed (days)</label>
              <input
                id="eotClaimedDays"
                name="eotClaimedDays"
                type="number"
                step="1"
                min="0"
                defaultValue={claim?.eotClaimedDays ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="eotApprovedDays" className={labelCls}>EOT Approved (days)</label>
              <input
                id="eotApprovedDays"
                name="eotApprovedDays"
                type="number"
                step="1"
                min="0"
                defaultValue={claim?.eotApprovedDays ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="dueDate" className={labelCls}>Due Date</label>
              <input id="dueDate" name="dueDate" type="date" defaultValue={claim?.dueDate ?? ''} className={inputCls} />
            </div>
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="eventDate" className={labelCls}>Event Date</label>
              <input id="eventDate" name="eventDate" type="date" defaultValue={claim?.eventDate ?? ''} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="claimDate" className={labelCls}>Claim Date</label>
              <input id="claimDate" name="claimDate" type="date" defaultValue={claim?.claimDate ?? ''} className={inputCls} />
            </div>
          </div>

          <div>
            <label htmlFor="nextAction" className={labelCls}>Next Action</label>
            <input
              id="nextAction"
              name="nextAction"
              type="text"
              maxLength={500}
              defaultValue={claim?.nextAction ?? ''}
              placeholder="What happens next on this claim?"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={2}
              maxLength={5000}
              defaultValue={claim?.remarks ?? ''}
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
            form="claim-form"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : mode === 'add' ? 'Add Claim' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
