'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  submitIncidentAction,
  startReviewAction,
  beginInvestigationAction,
  requestActionsAction,
  closeIncidentAction,
  assignAction,
  cancelIncidentAction,
  reopenIncidentAction,
  resolveIncidentAction,
  updateSeverityAction,
} from '../actions';
import type { ActionResult } from '../actions';
import type { Incident, UserRef } from '../../../../lib/incidents-api';

type Panel = 'cancel' | 'reopen' | 'resolve' | 'assign' | 'severity' | null;

interface Props {
  incident: Incident;
  currentUserId: string;
  permissions: string[];
  people: UserRef[];
}

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

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

export function IncidentTransitionsPanel({ incident, currentUserId, permissions, people }: Props): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Panel-specific state
  const [cancelReason, setCancelReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [openActionCount, setOpenActionCount] = useState<number | null>(null);
  const [confirmOpenActions, setConfirmOpenActions] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [newSeverity, setNewSeverity] = useState<string>(incident.severity);

  const has = (perm: string): boolean => permissions.includes(perm);
  const isOwner = incident.reportedByUserId === currentUserId;
  const { status, id } = incident;

  function openPanel(p: Panel): void {
    setActivePanel(p);
    setActionError(null);
    setOpenActionCount(null);
    setConfirmOpenActions(false);
  }

  function run(fn: () => Promise<ActionResult>): void {
    setActionError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        setActionError(result.error);
        if (result.openActionCount !== undefined) {
          setOpenActionCount(result.openActionCount);
        }
      }
    });
  }

  const buttons: React.JSX.Element[] = [];

  // DRAFT
  if (status === 'DRAFT') {
    if (isOwner) {
      buttons.push(
        <Link key="edit" href={`/incidents/${id}/edit`}
          className="block w-full rounded-md border border-border bg-surface-secondary px-4 py-2 text-center text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Edit Draft
        </Link>,
      );
      buttons.push(
        // FMP-INC-01E — "Submit" → "Submit Incident" (brief's own explicit
        // rename), plus a real helper line explaining what it does — the
        // brief's own named issue ("Actions panel does not explain what
        // Submit does").
        <div key="submit" className="space-y-1">
          <Btn variant="primary" disabled={isPending} onClick={() => run(() => submitIncidentAction(id))}>
            Submit Incident
          </Btn>
          <p className="text-[11px] text-text-muted">Submit this incident when the details and evidence are ready for review.</p>
        </div>,
      );
    }
    if (isOwner || has('incidents.manage')) {
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel Incident
        </Btn>,
      );
    }
  }

  // SUBMITTED
  if (status === 'SUBMITTED') {
    if (has('incidents.review')) {
      buttons.push(
        <Btn key="start-review" variant="primary" disabled={isPending} onClick={() => run(() => startReviewAction(id))}>
          Start Review
        </Btn>,
      );
    }
    if (isOwner || has('incidents.manage')) {
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel Incident
        </Btn>,
      );
    }
  }

  // UNDER_REVIEW
  if (status === 'UNDER_REVIEW') {
    if (has('incidents.review')) {
      buttons.push(
        <Btn key="assign" variant="secondary" onClick={() => openPanel(activePanel === 'assign' ? null : 'assign')}>
          Assign Investigator
        </Btn>,
      );
      buttons.push(
        <Btn key="severity" variant="secondary" onClick={() => openPanel(activePanel === 'severity' ? null : 'severity')}>
          Change Severity
        </Btn>,
      );
      buttons.push(
        <Btn key="begin" variant="primary" disabled={isPending} onClick={() => run(() => beginInvestigationAction(id))}>
          Begin Investigation
        </Btn>,
      );
    }
    if (has('incidents.manage')) {
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel Incident
        </Btn>,
      );
    }
  }

  // INVESTIGATION
  if (status === 'INVESTIGATION') {
    if (has('incidents.investigate')) {
      buttons.push(
        <Btn key="request-actions" variant="primary" disabled={isPending} onClick={() => run(() => requestActionsAction(id))}>
          Request Corrective Actions
        </Btn>,
      );
    }
    if (has('incidents.manage')) {
      buttons.push(
        <Btn key="severity" variant="secondary" onClick={() => openPanel(activePanel === 'severity' ? null : 'severity')}>
          Change Severity
        </Btn>,
      );
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel Incident
        </Btn>,
      );
    }
  }

  // ACTION_REQUIRED
  if (status === 'ACTION_REQUIRED') {
    if (has('incidents.investigate')) {
      buttons.push(
        <Btn key="resolve" variant="primary" onClick={() => openPanel(activePanel === 'resolve' ? null : 'resolve')}>
          Resolve Incident
        </Btn>,
      );
    }
    if (has('incidents.manage')) {
      buttons.push(
        <Btn key="severity" variant="secondary" onClick={() => openPanel(activePanel === 'severity' ? null : 'severity')}>
          Change Severity
        </Btn>,
      );
      buttons.push(
        <Btn key="cancel" variant="danger" onClick={() => openPanel(activePanel === 'cancel' ? null : 'cancel')}>
          Cancel Incident
        </Btn>,
      );
    }
  }

  // RESOLVED
  if (status === 'RESOLVED') {
    if (has('incidents.manage')) {
      buttons.push(
        <Btn key="close" variant="primary" disabled={isPending} onClick={() => run(() => closeIncidentAction(id))}>
          Close Incident
        </Btn>,
      );
      buttons.push(
        <Btn key="reopen" variant="secondary" onClick={() => openPanel(activePanel === 'reopen' ? null : 'reopen')}>
          Reopen Incident
        </Btn>,
      );
    }
  }

  // CLOSED or CANCELLED
  if (status === 'CLOSED' || status === 'CANCELLED') {
    if (has('incidents.manage')) {
      buttons.push(
        <Btn key="reopen" variant="secondary" onClick={() => openPanel(activePanel === 'reopen' ? null : 'reopen')}>
          Reopen Incident
        </Btn>,
      );
    }
  }

  // FMP-INC-01E — an empty `buttons` array is a real, valid outcome (e.g.
  // a plain viewer with no incidents.* action permission beyond
  // incidents.read looking at someone else's incident) — previously
  // rendered as literally nothing, matching the exact "Actions panel is
  // unclear" complaint this unit's brief names. An honest one-line
  // message replaces the silent empty state, matching the same fix
  // already applied to Factory Tasks (FMP-UI-20E) and Safety & Compliance
  // (FMP-UI-21D)'s own transitions panels.
  if (buttons.length === 0) {
    return <p className="text-xs text-text-muted">No actions available to you on this incident right now.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="space-y-2">{buttons}</div>

      {/* Error */}
      {actionError && !activePanel && (
        <p role="alert" className="text-xs text-danger">{actionError}</p>
      )}

      {/* Cancel panel */}
      {activePanel === 'cancel' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Cancel Incident</p>
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
              onClick={() => run(() => cancelIncidentAction(id, cancelReason.trim()))}
            >
              {isPending ? 'Cancelling…' : 'Confirm cancel'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setCancelReason(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Reopen panel */}
      {activePanel === 'reopen' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Reopen Incident</p>
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
              onClick={() => run(() => reopenIncidentAction(id, reopenReason.trim()))}
            >
              {isPending ? 'Reopening…' : 'Confirm reopen'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setReopenReason(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Resolve panel */}
      {activePanel === 'resolve' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Resolve Incident</p>
          <div>
            <label htmlFor="resolution-summary" className="block text-xs font-medium text-text-secondary">
              Resolution summary <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <textarea
              id="resolution-summary"
              rows={4}
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              maxLength={4000}
              placeholder="Describe how the incident was resolved"
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          {openActionCount !== null && openActionCount > 0 && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmOpenActions}
                onChange={(e) => setConfirmOpenActions(e.target.checked)}
                className="mt-0.5 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-sm text-warning">
                This incident has {openActionCount} open corrective action{openActionCount !== 1 ? 's' : ''}.
                Check to resolve anyway.
              </span>
            </label>
          )}
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn
              variant="primary"
              disabled={isPending || !resolutionSummary.trim() || (openActionCount !== null && openActionCount > 0 && !confirmOpenActions)}
              onClick={() => run(() => resolveIncidentAction(id, resolutionSummary.trim(), confirmOpenActions))}
            >
              {isPending ? 'Resolving…' : 'Resolve incident'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setResolutionSummary(''); setConfirmOpenActions(false); setOpenActionCount(null); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Assign panel */}
      {activePanel === 'assign' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Assign Investigator</p>
          <div>
            <label htmlFor="assign-user" className="block text-xs font-medium text-text-secondary">
              Investigator
            </label>
            <select
              id="assign-user"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
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
            <Btn variant="primary" disabled={isPending || !assigneeId}
              onClick={() => run(() => assignAction(id, assigneeId))}
            >
              {isPending ? 'Assigning…' : 'Assign'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setAssigneeId(''); }}>
              Back
            </Btn>
          </div>
        </div>
      )}

      {/* Severity panel */}
      {activePanel === 'severity' && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Change Severity</p>
          <div>
            <label htmlFor="new-severity" className="block text-xs font-medium text-text-secondary">
              Severity
            </label>
            <select
              id="new-severity"
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {actionError && <p role="alert" className="text-xs text-danger">{actionError}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" disabled={isPending || newSeverity === incident.severity}
              onClick={() => run(() => updateSeverityAction(id, newSeverity))}
            >
              {isPending ? 'Saving…' : 'Update severity'}
            </Btn>
            <Btn variant="secondary" onClick={() => { openPanel(null); setNewSeverity(incident.severity); }}>
              Back
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
