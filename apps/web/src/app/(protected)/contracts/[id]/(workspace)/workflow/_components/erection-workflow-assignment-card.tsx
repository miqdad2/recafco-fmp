'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCog } from 'lucide-react';
import { assignErectionWorkflowAction } from '../../../../actions';
import { inputCls, labelCls } from '../../../../_components/contract-form-fields';
import type { ContractErectionWorkflowAssignment, ContractPerson } from '@/lib/contracts-api';

interface Props {
  contractId: string;
  assignment: ContractErectionWorkflowAssignment | null;
  people: ContractPerson[];
  canManage: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Assigned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * CM-71H — "Erection Workflow Assignment" section on the Workflow & Team
 * Tasks tab: Assigned Erection Manager / Assigned Department / Assigned
 * Date / Assignment Status, plus the Assign/Change Assignment action.
 * Contract Manager remains the contract owner/monitor — this only assigns
 * the EXECUTION workflow to someone else (see the API service's own doc
 * comment for how this is kept distinct from Contract.ownerUserId).
 *
 * Only a manager-tier actor (contracts.update, same canManage the rest of
 * this page already computes) sees the Assign/Change Assignment button —
 * matches "Contract Manager assigns the Erection Workflow to an Erection
 * Manager." The assignee dropdown reuses the SAME real ContractPerson[]
 * list ("people") already fetched for the generic Team Task board's own
 * AssignTaskModal — no new users endpoint was added for this unit, and no
 * fake Erection Manager users were created (per this unit's own explicit
 * "do not create fake Erection Manager users" instruction).
 */
export function ErectionWorkflowAssignmentCard({ contractId, assignment, people, canManage }: Props): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    const assignedToUserId = (formData.get('assignedToUserId') as string | null) || undefined;
    const assignedToName = (formData.get('assignedToName') as string | null)?.trim() || undefined;
    const assignedDepartment = (formData.get('assignedDepartment') as string | null)?.trim() || undefined;
    const assignedAt = (formData.get('assignedAt') as string | null) || undefined;
    const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

    if (!assignedToUserId && !assignedToName) {
      setClientError('Select an Erection Manager or enter a name.');
      return;
    }

    setClientError(null);
    setIsSaving(true);
    try {
      const result = await assignErectionWorkflowAction(contractId, {
        ...(assignedToUserId !== undefined ? { assignedToUserId } : {}),
        ...(assignedToName !== undefined ? { assignedToName } : {}),
        ...(assignedDepartment !== undefined ? { assignedDepartment } : {}),
        ...(assignedAt !== undefined ? { assignedAt } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
      });
      if (result.error) {
        setClientError(result.error);
        return;
      }
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Erection Workflow assigned but router.refresh() failed:', refreshErr);
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Failed to assign Erection Workflow:', err);
      setClientError('Failed to assign the Erection Workflow. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <UserCog className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Erection Workflow Assignment</h2>
            <p className="text-xs text-text-secondary mt-0.5">Owned by Erection Department. Assign the Erection Workflow to an Erection Manager.</p>
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {assignment ? 'Change Erection Assignment' : 'Assign Erection Workflow'}
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-4">
        <div>
          <dt className="text-xs text-text-muted">Assigned Erection Manager</dt>
          <dd className="font-medium text-text-primary mt-0.5">{assignment?.assignedToUser?.displayName ?? assignment?.assignedToName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Assigned Department</dt>
          <dd className="font-medium text-text-primary mt-0.5">{assignment?.assignedDepartment ?? 'Erection Department'}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Assigned Date</dt>
          <dd className="font-medium text-text-primary mt-0.5">{formatDate(assignment?.assignedAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Assignment Status</dt>
          <dd className="font-medium text-text-primary mt-0.5">
            {assignment ? (STATUS_LABELS[assignment.status] ?? assignment.status) : <span className="text-text-muted">Not Assigned</span>}
          </dd>
        </div>
      </dl>

      {formOpen && canManage && (
        <form onSubmit={handleSubmit} className="mt-4 border-t border-border pt-4 space-y-3">
          {clientError && (
            <div className="rounded-md border border-error bg-error-light px-3 py-2 text-xs text-error">{clientError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="assignedToUserId" className={labelCls}>Erection Manager / Responsible Person</label>
              <select id="assignedToUserId" name="assignedToUserId" defaultValue={assignment?.assignedToUserId ?? ''} className={inputCls}>
                <option value="">Select a person…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">Or enter a name manually below if the person is not in this list.</p>
            </div>
            <div>
              <label htmlFor="assignedToName" className={labelCls}>Name (if not selected above)</label>
              <input id="assignedToName" name="assignedToName" type="text" maxLength={200} defaultValue={assignment?.assignedToUserId ? '' : (assignment?.assignedToName ?? '')} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="assignedDepartment" className={labelCls}>Department / Team</label>
              <input id="assignedDepartment" name="assignedDepartment" type="text" maxLength={150} defaultValue={assignment?.assignedDepartment ?? 'Erection Department'} className={inputCls} />
            </div>
            <div>
              <label htmlFor="assignedAt" className={labelCls}>Assignment Date</label>
              <input id="assignedAt" name="assignedAt" type="date" defaultValue={assignment?.assignedAt ?? todayDateInput()} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks <span className="text-text-muted font-normal">(optional)</span></label>
            <textarea id="remarks" name="remarks" rows={2} maxLength={5000} defaultValue={assignment?.remarks ?? ''} className={`${inputCls} resize-y`} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : assignment ? 'Save Assignment' : 'Assign'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
