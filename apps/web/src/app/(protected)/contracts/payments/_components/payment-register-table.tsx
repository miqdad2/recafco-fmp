'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Ban } from 'lucide-react';
import type { ContractPayment } from '@/lib/contracts-api';
import { formatContractValue } from '../../_lib/contract-ui-helpers';
import { cancelPaymentAction } from '../../actions';
import { overdueLabel, isUnpaid } from '../_lib/payment-register-helpers';
import { PaymentStatusBadge } from './payment-status-badge';
import { PaymentFormModal } from './payment-form-modal';
import { PaymentDetailModal } from './payment-detail-modal';

interface Props {
  payments: ContractPayment[];
  canUpdate: boolean;
}

type ModalState = { mode: 'view'; payment: ContractPayment } | { mode: 'edit'; payment: ContractPayment } | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const openBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus';

function StatusCell({ p }: { p: ContractPayment }): React.JSX.Element {
  const overdue = overdueLabel(p.overdueDays);
  return (
    <div className="flex flex-col items-start gap-1">
      <PaymentStatusBadge status={p.status} />
      {overdue && <span className="text-xs font-medium text-error">{overdue}</span>}
      {!overdue && isUnpaid(p) && <span className="text-xs text-text-secondary">Unpaid</span>}
    </div>
  );
}

export function PaymentRegisterTable({ payments, canUpdate }: Props): React.JSX.Element {
  const [modal, setModal] = useState<ModalState>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCancel(paymentId: string): void {
    if (!window.confirm('Cancel this payment? This keeps it in the register but marks it Cancelled.')) return;
    setCancellingId(paymentId);
    startTransition(async () => {
      await cancelPaymentAction(paymentId);
      setCancellingId(null);
      router.refresh();
    });
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No payments match these filters.</p>
        <p className="text-sm text-text-muted mt-1">Clear the filters, or add a payment from a contract or the Add Payment button.</p>
      </div>
    );
  }

  const openButton = (p: ContractPayment): React.JSX.Element => (
    <button type="button" onClick={() => setModal({ mode: 'view', payment: p })} className={openBtn} aria-label={`Open payment ${p.paymentNo || p.invoiceNumber || ''}`.trim()}>
      <Eye className="size-4" aria-hidden="true" />
      Open Payment
    </button>
  );

  const cancelButton = (p: ContractPayment): React.JSX.Element | null =>
    canUpdate && p.status !== 'CANCELLED' ? (
      <button
        type="button"
        onClick={() => handleCancel(p.id)}
        disabled={isPending && cancellingId === p.id}
        className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-error-light hover:text-error focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        title="Cancel Payment"
        aria-label="Cancel payment"
      >
        <Ban className="size-4" aria-hidden="true" />
      </button>
    ) : null;

  return (
    <div>
      {/* Desktop / tablet-landscape: compact 7-column table. */}
      <div className="hidden md:block rounded-lg border border-border bg-surface print:hidden">
        <table className="w-full table-fixed divide-y divide-border text-sm">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[25%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="border-b-2 border-border-strong bg-surface-secondary">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Invoice / Payment</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Contract / Client</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Submitted</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Paid</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Outstanding</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Status</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-3 py-3">
                  <p className="font-medium text-text-primary break-words">{p.invoiceNumber || '—'}</p>
                  <p className="text-xs text-text-secondary break-words">Pmt {p.paymentNo || '—'}</p>
                  <p className="text-xs text-text-muted">Due {formatDate(p.dueDate)}</p>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/contracts/${p.contract.id}`} className="font-medium text-accent hover:underline break-words line-clamp-2" title={p.contract.title}>
                    {p.contract.referenceNumber} — {p.contract.title}
                  </Link>
                  <p className="text-xs text-text-secondary break-words line-clamp-1" title={p.contract.counterpartyName}>{p.contract.counterpartyName}</p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{formatContractValue(p.submittedAmount, 'KWD')}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatContractValue(p.paidAmount, 'KWD')}</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-text-primary">
                  {p.outstandingAmount ? formatContractValue(p.outstandingAmount, 'KWD') : '—'}
                </td>
                <td className="px-3 py-3"><StatusCell p={p} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {openButton(p)}
                    {cancelButton(p)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per payment. */}
      <ul className="md:hidden space-y-3 print:hidden">
        {payments.map((p) => (
          <li key={p.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-text-primary break-words">Invoice {p.invoiceNumber || '—'}</p>
                <p className="text-xs text-text-secondary break-words">Pmt {p.paymentNo || '—'} · Due {formatDate(p.dueDate)}</p>
              </div>
              <StatusCell p={p} />
            </div>
            <div className="text-sm">
              <Link href={`/contracts/${p.contract.id}`} className="font-medium text-accent hover:underline break-words">
                {p.contract.referenceNumber} — {p.contract.title}
              </Link>
              <p className="text-xs text-text-secondary">{p.contract.counterpartyName}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-right">
              <div><dt className="text-xs text-text-secondary">Submitted</dt><dd className="text-sm tabular-nums">{formatContractValue(p.submittedAmount, 'KWD')}</dd></div>
              <div><dt className="text-xs text-text-secondary">Paid</dt><dd className="text-sm tabular-nums">{formatContractValue(p.paidAmount, 'KWD')}</dd></div>
              <div><dt className="text-xs text-text-secondary">Outstanding</dt><dd className="text-sm tabular-nums font-semibold">{p.outstandingAmount ? formatContractValue(p.outstandingAmount, 'KWD') : '—'}</dd></div>
            </dl>
            <div className="flex items-center justify-end gap-1">
              {openButton(p)}
              {cancelButton(p)}
            </div>
          </li>
        ))}
      </ul>

      {/* Print: the complete register columns (nothing from the on-screen simplification is dropped from paper). */}
      <table className="hidden print:table w-full text-[10px] border-collapse">
        <thead>
          <tr>
            {[
              'Payment No', 'Contract ID', 'Contract Name', 'Company / Client', 'Invoice #', 'Invoice Date',
              'Payment Term', 'Submitted', 'Certified', 'Paid', 'Outstanding', 'Due Date', 'Overdue Days', 'Status',
            ].map((c) => (
              <th key={c} className="border border-border px-1.5 py-1 text-left font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="border border-border px-1.5 py-1">{p.paymentNo || '—'}</td>
              <td className="border border-border px-1.5 py-1">{p.contract.referenceNumber}</td>
              <td className="border border-border px-1.5 py-1">{p.contract.title}</td>
              <td className="border border-border px-1.5 py-1">{p.contract.counterpartyName}</td>
              <td className="border border-border px-1.5 py-1">{p.invoiceNumber || '—'}</td>
              <td className="border border-border px-1.5 py-1">{formatDate(p.invoiceDate)}</td>
              <td className="border border-border px-1.5 py-1">{p.paymentTerm || '—'}</td>
              <td className="border border-border px-1.5 py-1 text-right">{formatContractValue(p.submittedAmount, 'KWD')}</td>
              <td className="border border-border px-1.5 py-1 text-right">{formatContractValue(p.certifiedAmount, 'KWD')}</td>
              <td className="border border-border px-1.5 py-1 text-right">{formatContractValue(p.paidAmount, 'KWD')}</td>
              <td className="border border-border px-1.5 py-1 text-right">{p.outstandingAmount ? formatContractValue(p.outstandingAmount, 'KWD') : '—'}</td>
              <td className="border border-border px-1.5 py-1">{formatDate(p.dueDate)}</td>
              <td className="border border-border px-1.5 py-1">{p.overdueDays !== null ? `${p.overdueDays}d` : '—'}</td>
              <td className="border border-border px-1.5 py-1">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal?.mode === 'view' && (
        <PaymentDetailModal
          payment={modal.payment}
          canEdit={canUpdate && modal.payment.status !== 'CANCELLED'}
          onEdit={() => setModal({ mode: 'edit', payment: modal.payment })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <PaymentFormModal mode="edit" payment={modal.payment} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
