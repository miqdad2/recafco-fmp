'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Ban, Receipt } from 'lucide-react';
import type { ContractPayment } from '@/lib/contracts-api';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';
import { cancelPaymentAction } from '../../../../actions';
import { ContractPaymentStatusBadge } from './contract-payment-status-badge';
import { PaymentFormModal } from '../../../../payments/_components/payment-form-modal';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  payments: ContractPayment[];
  contract: ContractOption;
  canUpdate: boolean;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; payment: ContractPayment } | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COLUMNS = [
  'Payment No.', 'Project / Contract', 'Invoice Amount (KWD)', 'Invoice Date', 'Submitted to Client',
  'Payment Due Date', 'Days Overdue', 'Received On', 'Received Amount (KWD)', 'Remaining Amount (KWD)',
  'Payment Status', 'Action',
];

/**
 * CM-58 — Contract Detail Payments tab, "Payment Tracker" table. Reuses the
 * real PaymentFormModal / cancelPaymentAction from the module-level
 * register (../../../payments/_components) — same Add/Edit fields, same
 * server action, same contracts.update gate — only the column set/labels
 * and (for Add) the fixed single-contract option are new. Column wording
 * fixes the approved screenshot's own confusing "Received Date" + "Paid On"
 * duplication:
 *   Submitted to Client = createdAt (when this record was entered/submitted
 *     into Contract Management — the closest real event to "submitted",
 *     since no separate submitted-date field is stored)
 *   Payment Due Date = dueDate (real)
 *   Received On = paidDate (real)
 *   Received Amount = paidAmount (real)
 *   Remaining Amount = outstandingAmount (real, server-computed)
 *   Days Overdue = overdueDays (real, server-computed; null/"—" once
 *     Received or Cancelled, or when no due date is overdue yet)
 * CM-58B — PaymentFormModal is rendered with variant="contractDetail": no
 * Contract picker (this table already only ever has one contract to add
 * against — the single option is submitted as a hidden field and shown as
 * read-only context instead), no Certified Amount field, and the modal's
 * own Submitted/Due/Paid labels renamed to match this table's column
 * wording. The module-level register's own modal usage is untouched
 * (default variant="register").
 */
export function ContractPaymentTrackerTable({ payments, contract, canUpdate }: Props): React.JSX.Element {
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

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Payment Tracker</h2>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'add' })}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Add Payment
          </button>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="flex items-center justify-center gap-2.5 rounded-md border border-dashed border-border bg-surface-secondary/40 py-5">
          <Receipt className="size-4 text-text-muted shrink-0" aria-hidden="true" />
          <p className="text-sm text-text-secondary">No payment records yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-350 divide-y divide-border text-xs">
            <thead className="border-b-2 border-border-strong">
              <tr className="bg-surface-secondary">
                {COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">{p.paymentNo || '—'}</td>
                  <td className="px-3 py-2 max-w-50 truncate" title={p.contract.title}>{p.contract.title}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatContractValue(p.submittedAmount, undefined)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.invoiceDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.dueDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.overdueDays !== null ? <span className="text-error font-medium">{p.overdueDays}d</span> : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.paidDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums text-success font-medium">
                    {formatContractValue(p.paidAmount, undefined)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums font-medium">
                    {p.outstandingAmount ? formatContractValue(p.outstandingAmount, undefined) : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><ContractPaymentStatusBadge status={p.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {canUpdate && p.status !== 'CANCELLED' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', payment: p })}
                          className="text-text-muted hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus rounded"
                          title="Edit Payment"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(p.id)}
                          disabled={isPending && cancellingId === p.id}
                          className="text-text-muted hover:text-error focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                          title="Cancel Payment"
                        >
                          <Ban className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === 'add' && (
        <PaymentFormModal mode="add" contracts={[contract]} onClose={() => setModal(null)} variant="contractDetail" />
      )}
      {modal?.mode === 'edit' && (
        <PaymentFormModal mode="edit" payment={modal.payment} onClose={() => setModal(null)} variant="contractDetail" />
      )}
    </section>
  );
}
