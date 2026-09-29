'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  scheduleInspectionAction,
  startInspectionAction,
  completeInspectionAction,
  closeInspectionAction,
  reopenInspectionAction,
  cancelInspectionAction,
} from '../actions';
import type { ActionResult } from '../actions';
import type { UserRef } from '../../../../lib/safety-api';

type Panel = 'schedule' | 'complete' | 'reopen' | 'cancel' | null;

interface Props {
  inspectionId: string;
  canEdit: boolean;
  canDoSchedule: boolean;
  canDoStart: boolean;
  canDoComplete: boolean;
  canDoClose: boolean;
  canDoReopen: boolean;
  canDoCancel: boolean;
  people: UserRef[];
}

function Btn({
  children,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}): React.JSX.Element {
  const cls: Record<string, string> = {
    primary: 'bg-accent text-white hover:bg-accent/90',
    secondary: 'border border-border bg-surface-secondary text-text-secondary hover:border-border-strong hover:text-text-primary',
    danger: 'border border-danger bg-danger-light text-danger hover:bg-danger hover:text-white',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 disabled:cursor-not-allowed ${cls[variant]}`}
    >
      {children}
    </button>
  );
}

/**
 * FMP-UI-21D — replaces the Inspection Detail page's old "Actions" section,
 * which only ever wired Start/Close through a raw
 * `<form action="/safety-compliance/{id}/start" method="POST">` — a plain
 * HTML form posting to a path on the WEB APP's own origin, not the API
 * (`API_BASE_URL`), so it never actually worked — and showed literal
 * "…use the API or this page will be extended with forms." text for
 * Schedule/Complete/Reopen/Cancel, which the brief explicitly calls out as
 * unfinished-looking and forbids. Every one of those 6 transitions (plus
 * Edit, moved in here from its own floating header button) is wired to
 * the REAL, already-implemented, already-permission-gated server action in
 * `actions.ts` — none were fabricated for this unit.
 *
 * Uses the same `useTransition` + manual FormData pattern established by
 * `factory-tasks/_components/task-transitions.tsx` and
 * `incidents/_components/incident-transitions.tsx` for multi-panel
 * "Available Actions" components — NOT `useActionState`, since these
 * transition actions are shared with panels this component fully controls
 * itself (no real `<form>` element submits them). Each of the 6
 * server actions this component calls now ends with `redirect(id)`
 * (added in this unit) so a successful transition forces the page to
 * re-render with fresh data — calling a Server Action directly (not via a
 * form submit) gives no other signal that data changed.
 */
export function SafetyInspectionTransitions({
  inspectionId,
  canEdit,
  canDoSchedule,
  canDoStart,
  canDoComplete,
  canDoClose,
  canDoReopen,
  canDoCancel,
  people,
}: Props): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [scheduledAt, setScheduledAt] = useState('');
  const [inspectorUserId, setInspectorUserId] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  function openPanel(p: Panel): void {
    setActivePanel(p);
    setActionError(null);
  }

  function run(fn: () => Promise<ActionResult>): void {
    setActionError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setActionError(result.error);
    });
  }

  const buttons: React.JSX.Element[] = [];

  if (canEdit) {
    buttons.push(
      <Link key="edit" href={`/safety-compliance/${inspectionId}/edit`}
        className="block w-full rounded-md border border-border bg-surface-secondary px-4 py-2 text-center text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Edit Inspection
      </Link>,
    );
  }

  if (canDoSchedule) {
    buttons.push(
      <Btn key="schedule" variant="primary" onClick={() => openPanel(activePanel === 'schedule' ? null : 'schedule')}>
        Schedule Inspection
      </Btn>,
    );
  }

  if (canDoStart) {
    buttons.push(
      <Btn key="start" variant="primary" disabled={isPending} onClick={() => run(() => startInspectionAction(inspectionId))}>
        {isPending ? 'Starting…' : 'Start Inspection'}
      </Btn>,
    );
  }

  if (canDoComplete) {
    buttons.push(
      <Btn key="complete" variant="primary" onClick={() => openPanel(activePanel === 'complete' ? null : 'complete')}>
        Complete Inspection
      </Btn>,
    );
  }

  if (canDoClose) {
    buttons.push(
      <Btn key="close" variant="primary" disabled={isPending} onClick={() => run(() => closeInspectionAction(inspectionId))}>
        {isPending ? 'Closing…' : 'Close Inspection'}
      </Btn>,
    );
  }

  if (canDoReopen) {
    buttons.push(
      <Btn key="reopen" variant="secondary" onClick={() => openPanel(activePanel === 'reopen' ? null : 'reopen')}>
        Reopen Inspection
      </Btn>,
    );
  }

  if (canDoCancel) {
    buttons.push(
      <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
        Cancel Inspection
      </Btn>,
    );
  }

  // FMP-UI-21D — an inspection can have zero real actions available to the
  // CURRENT viewer for its CURRENT status (e.g. a plain `safety.read`
  // viewer, or a CANCELLED inspection with no further real transitions) —
  // the brief's own required wording for this case, never "use the API".
  if (buttons.length === 0) {
    return <p className="text-xs text-text-muted">More actions will appear when available for this inspection status.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">{buttons}</div>

      {actionError && !activePanel && (
        <p role="alert" className="text-xs text-danger">{actionError}</p>
      )}

      {/* Schedule panel */}
      {activePanel === 'schedule' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Schedule Inspection</p>
          <div>
            <label htmlFor="schedule-date" className="block text-xs font-medium text-text-secondary">
              Date &amp; time <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <input
              id="schedule-date"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="schedule-inspector" className="block text-xs font-medium text-text-secondary">
              Inspector <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <select
              id="schedule-inspector"
              value={inspectorUserId}
              onChange={(e) => setInspectorUserId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select a person…</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName} (@{u.username})</option>
              ))}
            </select>
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || !scheduledAt || !inspectorUserId}
              onClick={() => {
                const fd = new FormData();
                fd.set('scheduledAt', new Date(scheduledAt).toISOString());
                fd.set('inspectorUserId', inspectorUserId);
                run(() => scheduleInspectionAction(inspectionId, { error: null }, fd));
              }}
            >
              {isPending ? 'Scheduling…' : 'Confirm schedule'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setScheduledAt(''); setInspectorUserId(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Complete panel */}
      {activePanel === 'complete' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Complete Inspection</p>
          <div>
            <label htmlFor="complete-conclusion" className="block text-xs font-medium text-text-secondary">
              Conclusion <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="complete-conclusion"
              rows={4}
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              maxLength={10000}
              placeholder="Summarize the outcome of this inspection"
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || !conclusion.trim()}
              onClick={() => {
                const fd = new FormData();
                fd.set('conclusion', conclusion.trim());
                run(() => completeInspectionAction(inspectionId, { error: null }, fd));
              }}
            >
              {isPending ? 'Saving…' : 'Confirm complete'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setConclusion(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Reopen panel */}
      {activePanel === 'reopen' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Reopen Inspection</p>
          <div>
            <label htmlFor="reopen-reason" className="block text-xs font-medium text-text-secondary">
              Reason <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="reopen-reason"
              rows={2}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              maxLength={1000}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || !reopenReason.trim()}
              onClick={() => {
                const fd = new FormData();
                fd.set('reason', reopenReason.trim());
                run(() => reopenInspectionAction(inspectionId, { error: null }, fd));
              }}
            >
              {isPending ? 'Reopening…' : 'Confirm reopen'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setReopenReason(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Cancel panel */}
      {activePanel === 'cancel' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Cancel Inspection</p>
          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-medium text-text-secondary">
              Reason <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="cancel-reason"
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={1000}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="danger" disabled={isPending || !cancelReason.trim()}
              onClick={() => {
                const fd = new FormData();
                fd.set('reason', cancelReason.trim());
                run(() => cancelInspectionAction(inspectionId, { error: null }, fd));
              }}
            >
              {isPending ? 'Cancelling…' : 'Confirm cancel'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setCancelReason(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
