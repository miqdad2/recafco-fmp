'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Pencil, ExternalLink, HandCoins, CheckCircle2 } from 'lucide-react';
import type { ContractClaim } from '@/lib/contracts-api';
import { formatContractValue } from '../../_lib/contract-ui-helpers';
import { formatDays, overdueLabel } from '../_lib/claim-register-helpers';
import { ClaimStatusBadge } from './claim-status-badge';
import { ClaimTypeBadge } from './claim-type-badge';

interface Props {
  claim: ContractClaim;
  /** Existing edit permission AND a non-terminal status — Edit / Settle / Close are hidden otherwise. */
  canAct: boolean;
  pending: boolean;
  onEdit: () => void;
  onSettleOrClose: (target: 'CLOSED' | 'SETTLED') => void;
  onClose: () => void;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-text-primary break-words">{children}</dd>
    </div>
  );
}

function Amount({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md border border-border bg-surface-secondary px-3 py-2.5">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-0.5 text-right tabular-nums text-base font-medium text-text-primary">{value}</p>
    </div>
  );
}

const actionBtn =
  'inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50';

export function ClaimDetailModal({ claim: c, canAct, pending, onEdit, onSettleOrClose, onClose }: Props): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overdue = overdueLabel(c.overdueDays);
  const currency = c.contract.currency ?? 'KWD';
  const text = (v: string | undefined): React.ReactNode =>
    v ? <span className="whitespace-pre-wrap">{v}</span> : '—';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8 print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="claim-detail-title" className="w-full max-w-3xl rounded-lg border border-border bg-surface shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary">Claim {c.claimNo || '—'}</p>
            <h2 id="claim-detail-title" className="text-lg font-semibold text-text-primary break-words">{c.claimTitle}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ClaimStatusBadge status={c.status} />
              <ClaimTypeBadge claimType={c.claimType} />
              {overdue && <span className="text-xs font-medium text-error">{overdue}</span>}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close claim details"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Value</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Amount label="Submitted" value={formatContractValue(c.submittedValue, currency)} />
              <Amount label="Approved" value={formatContractValue(c.approvedValue, currency)} />
              <Amount label="Outstanding" value={formatContractValue(c.outstandingValue ?? undefined, currency)} />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Extension of Time</h3>
            <div className="grid grid-cols-2 gap-3">
              <Amount label="Days claimed" value={formatDays(c.eotClaimedDays)} />
              <Amount label="Days approved" value={formatDays(c.eotApprovedDays)} />
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Contract / Project">
              <Link href={`/contracts/${c.contract.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                <span className="font-mono">{c.contract.referenceNumber}</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
              <span className="block">{c.contract.title}</span>
            </Field>
            <Field label="Client">{c.contract.counterpartyName || '—'}</Field>
            <Field label="Claim Type"><ClaimTypeBadge claimType={c.claimType} /></Field>
            <Field label="Department">{c.contract.department?.name ?? '—'}</Field>
            <Field label="Responsible Person">{c.responsibleUser?.displayName ?? '—'}</Field>
            <Field label="Contract Manager">{c.contract.ownerUser.displayName || '—'}</Field>
            <Field label="Event Date">{formatDate(c.eventDate)}</Field>
            <Field label="Claim Date">{formatDate(c.claimDate)}</Field>
            <Field label="Due Date">{formatDate(c.dueDate)}</Field>
            <Field label="Closed Date">{formatDate(c.closedDate)}</Field>
            <div className="sm:col-span-2"><Field label="Next Action">{text(c.nextAction)}</Field></div>
            <div className="sm:col-span-2"><Field label="Remarks">{text(c.remarks)}</Field></div>
          </dl>

          <div className="rounded-md border border-border px-3 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Record history</h3>
            <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Field label="Created">{c.createdByUser.displayName} · {formatDateTime(c.createdAt)}</Field>
              <Field label="Last updated">
                {c.updatedByUser ? `${c.updatedByUser.displayName} · ` : ''}
                {formatDateTime(c.updatedAt)}
              </Field>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Link href={`/contracts/${c.contract.id}/claims`} className={actionBtn}>
            View contract claims
          </Link>
          {canAct && (
            <>
              <button type="button" onClick={() => onSettleOrClose('SETTLED')} disabled={pending} className={actionBtn}>
                <HandCoins className="size-4" aria-hidden="true" />
                Settle
              </button>
              <button type="button" onClick={() => onSettleOrClose('CLOSED')} disabled={pending} className={actionBtn}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Close
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit Claim
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
