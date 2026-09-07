'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createClaimAction, updateClaimAction } from '../../actions';
import type { ContractClaim, ContractClaimType, ContractClaimStatus, ContractPerson } from '@/lib/contracts-api';
import { CONTRACT_CLAIM_TYPE_OPTIONS, CONTRACT_CLAIM_STATUS_OPTIONS } from '../../_lib/contract-ui-helpers';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../_components/contract-form-fields';
import {
  formatClaimContractContext,
  getClaimTypeGuidance,
  CLAIM_TYPE_GUIDANCE_TEXT,
  validateClaimFormValues,
} from '../../_lib/contract-claim-detail-helpers';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

/** Minimal readable identity for the one contract a "fixed contract" Add flow (the per-contract Claims tab) targets — never just a bare UUID. */
interface FixedContractContext {
  referenceNumber: string;
  title: string;
  counterpartyName?: string;
}

interface Props {
  mode: 'add' | 'edit';
  contracts?: ContractOption[];
  fixedContractId?: string;
  /** Readable contract identity for the fixed-contract Add flow, fetched by the caller (the per-contract Claims tab page) since it isn't derivable from `contracts` (never passed there) or from any claim record when the contract has no claims yet. */
  fixedContract?: FixedContractContext;
  claim?: ContractClaim;
  people: ContractPerson[];
  onClose: () => void;
}

const sectionLabelCls = 'text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1';

/**
 * CM-70C — Add / Edit Claim modal, organized into 4 clear sections (Claim
 * Identity, Financial / EOT Claim, Dates & Responsibility, Next Action &
 * Remarks) with field-level helper text, status-aware validation, and a
 * readable "REF · Title · Client" contract display in place of a raw
 * contract UUID. Claim Type/Status remain normal editable selects — no field
 * is ever hidden, only extra guidance copy changes with the selected type.
 * All validation is frontend-only (validateClaimFormValues, see
 * contract-claim-detail-helpers.ts); computeClaimSummary() on the backend
 * and both claim DTOs are unchanged.
 */
export function ClaimFormModal({ mode, contracts, fixedContractId, fixedContract, claim, people, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const contractId = fixedContractId ?? claim?.contractId;

  const [claimType, setClaimType] = useState<ContractClaimType>(claim?.claimType ?? 'OTHER');
  const [status, setStatus] = useState<ContractClaimStatus>(claim?.status ?? 'DRAFT');
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const typeGuidance = getClaimTypeGuidance(claimType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    const errors = validateClaimFormValues({
      claimTitle: String(formData.get('claimTitle') ?? ''),
      status,
      submittedValue: String(formData.get('submittedValue') ?? ''),
      approvedValue: String(formData.get('approvedValue') ?? ''),
      eotClaimedDays: String(formData.get('eotClaimedDays') ?? ''),
      eotApprovedDays: String(formData.get('eotApprovedDays') ?? ''),
      eventDate: String(formData.get('eventDate') ?? ''),
      claimDate: String(formData.get('claimDate') ?? ''),
      dueDate: String(formData.get('dueDate') ?? ''),
    });
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      return;
    }
    setClientError(null);
    setIsSaving(true);
    try {
      const result =
        mode === 'edit' && claim
          ? await updateClaimAction(claim.id, claim.contractId, { error: null }, formData)
          : await createClaimAction({ error: null }, formData);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      onClose();
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Claim saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save claim:', err);
      setClientError('Failed to save claim. Please try again.');
    } finally {
      setIsSaving(false);
    }
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

        <form id="claim-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {clientError && (
            <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
              {clientError}
            </div>
          )}

          <p className={sectionLabelCls}>Claim Identity</p>

          {mode === 'add' && !fixedContractId ? (
            <div>
              <label htmlFor="contractId" className={labelCls}>
                Contract <span className="text-error">*</span>
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
                    {fixedContract
                      ? formatClaimContractContext(fixedContract)
                      : contracts?.find((c) => c.id === fixedContractId)
                        ? formatClaimContractContext(contracts.find((c) => c.id === fixedContractId)!)
                        : 'Loading contract…'}
                  </p>
                </div>
              )}
              {mode === 'edit' && claim && (
                <div>
                  <span className={labelCls}>Contract</span>
                  <p className="text-sm text-text-primary">{formatClaimContractContext(claim.contract)}</p>
                </div>
              )}
            </>
          )}

          <div>
            <label htmlFor="claimTitle" className={labelCls}>
              Claim Title <span className="text-error">*</span>
            </label>
            <input
              id="claimTitle"
              name="claimTitle"
              type="text"
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
              <p className="text-[11px] text-text-muted mt-1">Recommended — helps track this claim in reports and correspondence.</p>
            </div>
            <div>
              <label htmlFor="claimType" className={labelCls}>Claim Type</label>
              <select
                id="claimType"
                name="claimType"
                value={claimType}
                onChange={(e) => setClaimType(e.target.value as ContractClaimType)}
                className={inputCls}
              >
                {CONTRACT_CLAIM_TYPE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>Status</label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractClaimStatus)}
                className={inputCls}
              >
                {CONTRACT_CLAIM_STATUS_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">Use Submitted when claim has been submitted to client. Use Approved only when client approval is confirmed.</p>
            </div>
          </div>

          <p className={sectionLabelCls}>Financial / EOT Claim</p>
          <InfoBox variant="subtle">{CLAIM_TYPE_GUIDANCE_TEXT[typeGuidance]}</InfoBox>

          <div className={gridCls3}>
            <div>
              <label htmlFor="submittedValue" className={labelCls}>Submitted Value</label>
              <input
                id="submittedValue"
                name="submittedValue"
                type="number"
                step="0.001"
                defaultValue={claim?.submittedValue ?? ''}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Amount claimed from the client.</p>
            </div>
            <div>
              <label htmlFor="approvedValue" className={labelCls}>Approved Value</label>
              <input
                id="approvedValue"
                name="approvedValue"
                type="number"
                step="0.001"
                defaultValue={claim?.approvedValue ?? ''}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Amount approved by the client.</p>
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
                defaultValue={claim?.eotClaimedDays ?? ''}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Extension of time days requested.</p>
            </div>
            <div>
              <label htmlFor="eotApprovedDays" className={labelCls}>EOT Approved (days)</label>
              <input
                id="eotApprovedDays"
                name="eotApprovedDays"
                type="number"
                step="1"
                defaultValue={claim?.eotApprovedDays ?? ''}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Extension of time days approved.</p>
            </div>
          </div>

          <p className={sectionLabelCls}>Dates &amp; Responsibility</p>

          <div className={gridCls3}>
            <div>
              <label htmlFor="eventDate" className={labelCls}>Event Date</label>
              <input id="eventDate" name="eventDate" type="date" defaultValue={claim?.eventDate ?? ''} className={inputCls} />
              <p className="text-[11px] text-text-muted mt-1">Date the issue or delay happened.</p>
            </div>
            <div>
              <label htmlFor="claimDate" className={labelCls}>
                Claim Date {status === 'APPROVED' && <span className="text-error">*</span>}
              </label>
              <input id="claimDate" name="claimDate" type="date" defaultValue={claim?.claimDate ?? ''} className={inputCls} />
              <p className="text-[11px] text-text-muted mt-1">Date the claim was registered/submitted.</p>
            </div>
            <div>
              <label htmlFor="dueDate" className={labelCls}>Due Date</label>
              <input id="dueDate" name="dueDate" type="date" defaultValue={claim?.dueDate ?? ''} className={inputCls} />
              <p className="text-[11px] text-text-muted mt-1">Date by which follow-up or response is expected.</p>
            </div>
          </div>

          <div>
            <label htmlFor="responsibleUserId" className={labelCls}>Responsible Person</label>
            <select id="responsibleUserId" name="responsibleUserId" defaultValue={claim?.responsibleUserId ?? ''} className={inputCls}>
              <option value="">— Unassigned —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
            {people.length === 0 && (
              <p className="text-[11px] text-text-muted mt-1">No eligible users found.</p>
            )}
          </div>

          <p className={sectionLabelCls}>Next Action &amp; Remarks</p>

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
            disabled={isSaving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : mode === 'add' ? 'Add Claim' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
