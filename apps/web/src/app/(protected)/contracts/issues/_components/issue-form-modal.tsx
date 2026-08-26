'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { createIssueAction, updateIssueAction } from '../../actions';
import type { ContractIssue, ContractPerson } from '@/lib/contracts-api';
import { CONTRACT_ISSUE_CATEGORIES } from '../../_lib/contract-ui-helpers';
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

export function IssueFormModal({ mode, contracts, fixedContractId, issue, people, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const contractId = fixedContractId ?? issue?.contractId;
  const action = mode === 'edit' && issue ? updateIssueAction.bind(null, issue.id, issue.contractId) : createIssueAction;
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const [status, setStatus] = useState<string>(issue?.status ?? 'OPEN');
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

  const showResolution = RESOLUTION_STATUSES.includes(status);

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
                    {issue?.contract.referenceNumber} — {issue?.contract.title}
                  </p>
                </div>
              )}
            </>
          )}

          <div>
            <label htmlFor="title" className={labelCls}>
              Issue Title <span className="text-danger">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
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
            </div>
            <div>
              <label htmlFor="category" className={labelCls}>Category</label>
              <select id="category" name="category" defaultValue={issue?.category ?? ''} className={inputCls}>
                <option value="">— Select —</option>
                {CONTRACT_ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className={labelCls}>Priority</label>
              <select id="priority" name="priority" defaultValue={issue?.priority ?? 'MEDIUM'} className={inputCls}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="status" className={labelCls}>Status</label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputCls}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="responsibleUserId" className={labelCls}>Responsible Person</label>
              <select id="responsibleUserId" name="responsibleUserId" defaultValue={issue?.responsibleUserId ?? ''} className={inputCls}>
                <option value="">— Unassigned —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dueDate" className={labelCls}>Due Date</label>
              <input id="dueDate" name="dueDate" type="date" defaultValue={issue?.dueDate ?? ''} className={inputCls} />
            </div>
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="raisedDate" className={labelCls}>Raised Date</label>
              <input id="raisedDate" name="raisedDate" type="date" defaultValue={issue?.raisedDate ?? ''} className={inputCls} />
            </div>
            {showResolution && (
              <div className="sm:col-span-2">
                <label htmlFor="closedDate" className={labelCls}>Closed Date</label>
                <input id="closedDate" name="closedDate" type="date" defaultValue={issue?.closedDate ?? ''} className={inputCls} />
              </div>
            )}
          </div>

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
              <label htmlFor="resolution" className={labelCls}>Resolution</label>
              <textarea
                id="resolution"
                name="resolution"
                rows={3}
                maxLength={10000}
                defaultValue={issue?.resolution ?? ''}
                placeholder="How was this issue resolved?"
                className={`${inputCls} resize-y`}
              />
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
