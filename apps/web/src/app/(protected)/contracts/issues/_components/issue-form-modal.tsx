'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { createIssueAction, updateIssueAction } from '../../actions';
import type { ContractIssue, ContractIssueStatus, ContractPerson } from '@/lib/contracts-api';
import { CONTRACT_ISSUE_CATEGORIES } from '../../_lib/contract-ui-helpers';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../_components/contract-form-fields';
import {
  formatIssueContractContext,
  isResponsiblePersonRequired,
  isActionDueDateRequired,
  isResolutionRequired,
  validateIssueFormValues,
} from '../../_lib/contract-issue-detail-helpers';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

/** Minimal readable identity for the one contract a "fixed contract" Add flow (the per-contract Issue Log tab) targets — never just a bare UUID. */
interface FixedContractContext {
  referenceNumber: string;
  title: string;
  counterpartyName?: string;
}

interface Props {
  mode: 'add' | 'edit';
  contracts?: ContractOption[];
  fixedContractId?: string;
  /** Readable contract identity for the fixed-contract Add flow, fetched by the caller (the per-contract Issue Log tab page) since it isn't derivable from `contracts` (never passed there) or from any issue record when the contract has no issues yet. */
  fixedContract?: FixedContractContext;
  issue?: ContractIssue;
  people: ContractPerson[];
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_RESPONSE', label: 'Waiting Response' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const RESOLUTION_STATUSES = ['RESOLVED', 'CLOSED'];

const sectionLabelCls = 'text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1';

/** Today as a YYYY-MM-DD string — used only to pre-fill Issue Raised Date on a brand-new issue (Add mode); an existing issue's own stored raisedDate is never overwritten. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * CM-70D — Add / Edit Issue modal, organized into 4 clear sections (Issue
 * Identity, Priority & Responsibility, Dates, Details & Remarks) with
 * field-level helper text, status-aware validation, and a readable
 * "REF · Title · Client" contract display in place of a raw contract UUID.
 * Category options are the real, unchanged 9-value backend list
 * (CONTRACT_ISSUE_CATEGORIES) — already plain human-readable words, so no
 * relabeling was added (see this unit's own audit note); Status labels reuse
 * the existing STATUS_OPTIONS below, already user-friendly. All validation
 * is frontend-only (validateIssueFormValues, see
 * contract-issue-detail-helpers.ts); computeIssueSummary() on the backend
 * and both issue DTOs are unchanged.
 */
export function IssueFormModal({ mode, contracts, fixedContractId, fixedContract, issue, people, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const contractId = fixedContractId ?? issue?.contractId;
  const action = mode === 'edit' && issue ? updateIssueAction.bind(null, issue.id, issue.contractId) : createIssueAction;
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const [status, setStatus] = useState<ContractIssueStatus>(issue?.status ?? 'OPEN');
  const [clientError, setClientError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && !state.error) {
      submittedRef.current = false;
      onClose();
      router.refresh();
    }
  }, [state, isPending, onClose, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    const formData = new FormData(e.currentTarget);
    const errors = validateIssueFormValues({
      title: String(formData.get('title') ?? ''),
      status,
      responsibleUserId: String(formData.get('responsibleUserId') ?? ''),
      raisedDate: String(formData.get('raisedDate') ?? ''),
      dueDate: String(formData.get('dueDate') ?? ''),
      resolution: String(formData.get('resolution') ?? ''),
      remarks: String(formData.get('remarks') ?? ''),
    });
    if (errors.length > 0) {
      e.preventDefault();
      setClientError(errors.join(' '));
      return;
    }
    setClientError(null);
    submittedRef.current = true;
  }

  const showResolution = RESOLUTION_STATUSES.includes(status);
  const responsibleRequired = isResponsiblePersonRequired(status);
  const dueDateRequired = isActionDueDateRequired(status);
  const resolutionRequired = isResolutionRequired(status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,860px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <h2 id="issue-form-title" className="text-lg font-semibold text-text-primary">
            {mode === 'add' ? 'Add Issue' : 'Edit Issue'}
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

        <form id="issue-form" action={formAction} onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {(clientError ?? state.error) && (
            <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
              {clientError ?? state.error}
            </div>
          )}

          <InfoBox variant="subtle">Record issues that need follow-up until they are resolved.</InfoBox>

          <p className={sectionLabelCls}>Issue Identity</p>

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
                      ? formatIssueContractContext(fixedContract)
                      : contracts?.find((c) => c.id === fixedContractId)
                        ? formatIssueContractContext(contracts.find((c) => c.id === fixedContractId)!)
                        : 'Loading contract…'}
                  </p>
                </div>
              )}
              {mode === 'edit' && issue && (
                <div>
                  <span className={labelCls}>Contract</span>
                  <p className="text-sm text-text-primary">{formatIssueContractContext(issue.contract)}</p>
                </div>
              )}
            </>
          )}

          <div>
            <label htmlFor="title" className={labelCls}>
              Issue Title <span className="text-error">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              maxLength={300}
              defaultValue={issue?.title ?? ''}
              placeholder="Short description of the issue"
              className={inputCls}
            />
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="issueNo" className={labelCls}>Issue No.</label>
              <input
                id="issueNo"
                name="issueNo"
                type="text"
                maxLength={50}
                defaultValue={issue?.issueNo ?? ''}
                placeholder="e.g. ISS-001"
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Optional tracking number such as ISS-GRM-001.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="category" className={labelCls}>Category</label>
              <select id="category" name="category" defaultValue={issue?.category ?? ''} className={inputCls}>
                <option value="">— Select —</option>
                {CONTRACT_ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">Select the area affected by this issue.</p>
            </div>
          </div>

          <p className={sectionLabelCls}>Priority &amp; Responsibility</p>

          <div className={gridCls3}>
            <div>
              <label htmlFor="priority" className={labelCls}>Priority</label>
              <select id="priority" name="priority" defaultValue={issue?.priority ?? 'MEDIUM'} className={inputCls}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>Status</label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractIssueStatus)}
                className={inputCls}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="responsibleUserId" className={labelCls}>
                Responsible Person {responsibleRequired && <span className="text-error">*</span>}
              </label>
              <select id="responsibleUserId" name="responsibleUserId" defaultValue={issue?.responsibleUserId ?? ''} className={inputCls}>
                <option value="">— Unassigned —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">
                {people.length === 0
                  ? 'No eligible users found. Create a Contract Staff user first.'
                  : 'Person responsible to follow up and close this issue.'}
              </p>
            </div>
          </div>

          <p className={sectionLabelCls}>Dates</p>

          <div className={gridCls3}>
            <div>
              <label htmlFor="raisedDate" className={labelCls}>Issue Raised Date</label>
              <input
                id="raisedDate"
                name="raisedDate"
                type="date"
                defaultValue={issue?.raisedDate ?? (mode === 'add' ? todayIso() : '')}
                className={inputCls}
              />
              <p className="text-[11px] text-text-muted mt-1">Date the issue was reported.</p>
            </div>
            <div>
              <label htmlFor="dueDate" className={labelCls}>
                Action Due Date {dueDateRequired && <span className="text-error">*</span>}
              </label>
              <input id="dueDate" name="dueDate" type="date" defaultValue={issue?.dueDate ?? ''} className={inputCls} />
              <p className="text-[11px] text-text-muted mt-1">Date by which the responsible person should resolve or follow up.</p>
            </div>
            {showResolution && (
              <div>
                <label htmlFor="closedDate" className={labelCls}>Closed Date</label>
                <input id="closedDate" name="closedDate" type="date" defaultValue={issue?.closedDate ?? ''} className={inputCls} />
              </div>
            )}
          </div>

          <p className={sectionLabelCls}>Details &amp; Remarks</p>

          <div>
            <label htmlFor="description" className={labelCls}>Description</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={10000}
              defaultValue={issue?.description ?? ''}
              className={`${inputCls} resize-y`}
            />
          </div>

          {showResolution && (
            <div>
              <label htmlFor="resolution" className={labelCls}>
                Resolution {resolutionRequired && <span className="text-error">*</span>}
              </label>
              <textarea
                id="resolution"
                name="resolution"
                rows={3}
                maxLength={10000}
                defaultValue={issue?.resolution ?? ''}
                placeholder="How was this issue resolved?"
                className={`${inputCls} resize-y`}
              />
              <p className="text-[11px] text-text-muted mt-1">A Resolution note or Remarks below is required to close this issue.</p>
            </div>
          )}

          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={2}
              maxLength={5000}
              defaultValue={issue?.remarks ?? ''}
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
            form="issue-form"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : mode === 'add' ? 'Add Issue' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
