'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Pencil, ExternalLink } from 'lucide-react';
import type { ContractPayment } from '@/lib/contracts-api';
import { formatContractValue } from '../../_lib/contract-ui-helpers';
import { overdueLabel } from '../_lib/payment-register-helpers';
import { PaymentStatusBadge } from './payment-status-badge';

interface Props {
  payment: ContractPayment;
  /** Existing edit permission AND a non-cancelled payment — the Edit button is hidden otherwise. */
  canEdit: boolean;
  onEdit: () => void;
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

function Amount({ label, value, strong }: { label: string; value: string; strong?: boolean }): React.JSX.Element {
  return (
    <div className="rounded-md border border-border bg-surface-secondary px-3 py-2.5">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className={`mt-0.5 text-right tabular-nums text-base ${strong ? 'font-semibold' : 'font-medium'} text-text-primary`}>{value}</p>
    </div>
  );
}

export function PaymentDetailModal({ payment: p, canEdit, onEdit, onClose }: Props): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overdue = overdueLabel(p.overdueDays);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8 print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="payment-detail-title" className="w-full max-w-3xl rounded-lg border border-border bg-surface shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="payment-detail-title" className="text-lg font-semibold text-text-primary">
              Payment {p.paymentNo || '—'}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <PaymentStatusBadge status={p.status} />
              {overdue && <span className="text-xs font-medium text-error">{overdue}</span>}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close payment details"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Amount label="Submitted" value={formatContractValue(p.submittedAmount, 'KWD')} />
            <Amount label="Certified" value={formatContractValue(p.certifiedAmount, 'KWD')} />
            <Amount label="Paid" value={formatContractValue(p.paidAmount, 'KWD')} />
            <Amount label="Outstanding" value={p.outstandingAmount ? formatContractValue(p.outstandingAmount, 'KWD') : '—'} strong />
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Payment Number">{p.paymentNo || '—'}</Field>
            <Field label="Invoice Number">{p.invoiceNumber || '—'}</Field>
            <Field label="Contract / Project">
              <Link href={`/contracts/${p.contract.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                <span className="font-mono">{p.contract.referenceNumber}</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
              <span className="block">{p.contract.title}</span>
            </Field>
            <Field label="Client">{p.contract.counterpartyName || '—'}</Field>
            <Field label="Payment Term">{p.paymentTerm || '—'}</Field>
            <Field label="Contract Manager">{p.contract.ownerUser.displayName || '—'}</Field>
            <Field label="Invoice Date">{formatDate(p.invoiceDate)}</Field>
            <Field label="Due Date">{formatDate(p.dueDate)}</Field>
            <Field label="Paid Date">{formatDate(p.paidDate)}</Field>
            <Field label="Overdue">{overdue ?? '—'}</Field>
            <div className="sm:col-span-2">
              <Field label="Remarks">{p.remarks ? <span className="whitespace-pre-wrap">{p.remarks}</span> : '—'}</Field>
            </div>
          </dl>

          <div className="rounded-md border border-border px-3 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Record history</h3>
            <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Field label="Created">{p.createdByUser.displayName} · {formatDateTime(p.createdAt)}</Field>
              <Field label="Last updated">
                {p.updatedByUser ? `${p.updatedByUser.displayName} · ` : ''}
                {formatDateTime(p.updatedAt)}
              </Field>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Link
            href={`/contracts/${p.contract.id}/payments`}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View contract payments
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
