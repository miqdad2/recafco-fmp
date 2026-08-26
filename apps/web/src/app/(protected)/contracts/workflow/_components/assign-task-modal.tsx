'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { updateWorkflowTaskAction } from '../../actions';
import type { ContractPerson, WorkflowAssignmentQueueItem } from '@/lib/contracts-api';
import { inputCls, labelCls } from '../../_components/contract-form-fields';

interface Props {
  item: WorkflowAssignmentQueueItem;
  people: ContractPerson[];
  onClose: () => void;
  onAssigned: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const TEAM_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical Team',
  PRODUCTION: 'Production Team',
  ERECTION: 'Erection Team',
  QS_COMMERCIAL: 'QS / Commercial Team',
};

/**
 * CM-40 — compact assignment modal, deliberately narrower than the full
 * WorkflowTaskDrawer (no status/comments/attachments — those stay on the
 * board). Submits through the SAME existing updateWorkflowTaskAction/
 * PATCH /contracts/workflow/tasks/:taskId used everywhere else, so no new
 * backend write path was introduced for this unit.
 */
export function AssignTaskModal({ item, people, onClose, onAssigned }: Props): React.JSX.Element {
  const router = useRouter();
  const action = updateWorkflowTaskAction.bind(null, item.taskId, item.contractId);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, { error: null });
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !pending && !state.error) {
      submittedRef.current = false;
      router.refresh();
      onAssigned();
    }
  }, [state, pending, router, onAssigned]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-task-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="assign-task-modal-title" className="text-sm font-semibold text-text-primary">Assign Task</h2>
            <p className="text-xs text-text-secondary mt-0.5 truncate">
              {item.contractReference} · {item.contractTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form
          action={formAction}
          onSubmit={() => { submittedRef.current = true; }}
          className="px-5 py-4 space-y-4"
        >
          {state.error && (
            <div className="rounded-md border border-danger bg-danger-light px-3 py-2 text-xs text-danger">
              {state.error}
            </div>
          )}

          <div className="rounded-md border border-border bg-surface-secondary/40 px-3 py-2 text-xs text-text-secondary space-y-0.5">
            <p><span className="text-text-muted">Team:</span> {TEAM_LABELS[item.team] ?? item.team}</p>
            <p><span className="text-text-muted">Task:</span> {item.taskName}</p>
          </div>

          <div>
            <label htmlFor="responsibleUserId" className={labelCls}>Responsible Person</label>
            <select id="responsibleUserId" name="responsibleUserId" required defaultValue="" className={inputCls}>
              <option value="" disabled>Select a person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dueDate" className={labelCls}>Due Date</label>
              <input id="dueDate" name="dueDate" type="date" defaultValue={item.dueDate ?? ''} className={inputCls} />
            </div>
            <div>
              <label htmlFor="priority" className={labelCls}>Priority</label>
              <select id="priority" name="priority" defaultValue={item.priority} className={inputCls}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="remarks" className={labelCls}>
              Remarks <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <textarea id="remarks" name="remarks" rows={2} maxLength={5000} className={`${inputCls} resize-y`} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {pending ? 'Assigning…' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
