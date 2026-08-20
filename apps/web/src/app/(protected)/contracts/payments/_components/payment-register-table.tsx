'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Ban } from 'lucide-react';
import type { ContractPayment } from '@/lib/contracts-api';
import { formatContractValue } from '../../_lib/contract-ui-helpers';
import { cancelPaymentAction } from '../../actions';
import { PaymentStatusBadge } from './payment-status-badge';
import { PaymentFormModal } from './payment-form-modal';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  payments: ContractPayment[];
  contracts: ContractOption[];
  canUpdate: boolean;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; payment: ContractPayment } | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PaymentRegisterTable({ payments, contracts, canUpdate }: Props): React.JSX.Element {
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
    <div>
      {canUpdate && (
        <div className="flex items-center justify-end mb-3 print:hidden">
          <button
            type="button"
            onClick={() => setModal({ mode: 'add' })}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Add Payment
          </button>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">No payments recorded yet.</p>
          <p className="text-sm text-text-muted mt-1">Add the first payment from a contract or from this register.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[1700px] divide-y divide-border text-xs">
            <thead className="border-b-2 border-border-strong">
              <tr className="bg-surface-secondary">
                {[
                  'Payment No', 'Contract ID', 'Contract Name', 'Company / Client', 'Invoice #', 'Invoice Date',
                  'Payment Term', 'Submitted Amount', 'Certified Amount', 'Paid Amount', 'Outstanding Amount',
                  'Due Date', 'Overdue Days', 'Status', 'Action',
                ].map((col) => (
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/contracts/${p.contract.id}`} className="font-mono text-accent hover:underline">
                      {p.contract.referenceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={p.contract.title}>{p.contract.title}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={p.contract.counterpartyName}>{p.contract.counterpartyName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.invoiceNumber || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.invoiceDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.paymentTerm || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{formatContractValue(p.submittedAmount, 'KWD')}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{formatContractValue(p.certifiedAmount, 'KWD')}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">{formatContractValue(p.paidAmount, 'KWD')}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                    {p.outstandingAmount ? formatContractValue(p.outstandingAmount, 'KWD') : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.dueDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.overdueDays !== null ? (
                      <span className="text-danger font-medium">{p.overdueDays}d</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><PaymentStatusBadge status={p.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap print:hidden">
                    <div className="flex items-center gap-2">
                      <Link href={`/contracts/${p.contract.id}`} className="text-text-muted hover:text-text-primary" title="View Contract">
                        View
                      </Link>
                      {canUpdate && p.status !== 'CANCELLED' && (
                        <>
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
                            className="text-text-muted hover:text-danger focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                            title="Cancel Payment"
                          >
                            <Ban className="size-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === 'add' && (
        <PaymentFormModal mode="add" contracts={contracts} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <PaymentFormModal mode="edit" payment={modal.payment} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
