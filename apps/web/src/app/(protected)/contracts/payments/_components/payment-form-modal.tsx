'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { createPaymentAction, updatePaymentAction } from '../../actions';
import type { ContractPayment } from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3 } from '../../_components/contract-form-fields';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  mode: 'add' | 'edit';
  contracts?: ContractOption[];
  payment?: ContractPayment;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'CERTIFIED', label: 'Certified' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function PaymentFormModal({ mode, contracts, payment, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const action = mode === 'edit' && payment ? updatePaymentAction.bind(null, payment.id) : createPaymentAction;
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,860px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <h2 id="payment-form-title" className="text-lg font-semibold text-text-primary">
            {mode === 'add' ? 'Add Payment' : 'Edit Payment'}
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

        <form id="payment-form" action={formAction} onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {state.error && (
            <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
              {state.error}
            </div>
          )}

          {mode === 'add' ? (
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
            <div>
              <span className={labelCls}>Contract</span>
              <p className="text-sm text-text-primary">
                {payment?.contract.referenceNumber} — {payment?.contract.title}
              </p>
            </div>
          )}

          <div className={gridCls3}>
            <div>
              <label htmlFor="paymentNo" className={labelCls}>Payment No.</label>
              <input
                id="paymentNo"
                name="paymentNo"
                type="text"
                maxLength={50}
                defaultValue={payment?.paymentNo ?? ''}
                placeholder="e.g. PAY-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="invoiceNumber" className={labelCls}>Invoice Number</label>
              <input
                id="invoiceNumber"
                name="invoiceNumber"
                type="text"
                maxLength={100}
                defaultValue={payment?.invoiceNumber ?? ''}
                placeholder="e.g. INV-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="invoiceDate" className={labelCls}>Invoice Date</label>
              <input
                id="invoiceDate"
                name="invoiceDate"
                type="date"
                defaultValue={payment?.invoiceDate ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="paymentTerm" className={labelCls}>Payment Term</label>
              <input
                id="paymentTerm"
                name="paymentTerm"
                type="text"
                maxLength={100}
                defaultValue={payment?.paymentTerm ?? ''}
                placeholder="e.g. Net 30"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="dueDate" className={labelCls}>Due Date</label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={payment?.dueDate ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="paidDate" className={labelCls}>Paid Date</label>
              <input
                id="paidDate"
                name="paidDate"
                type="date"
                defaultValue={payment?.paidDate ?? ''}
                className={inputCls}
              />
            </div>
          </div>

          <div className={gridCls3}>
            <div>
              <label htmlFor="submittedAmount" className={labelCls}>Submitted Amount</label>
              <input
                id="submittedAmount"
                name="submittedAmount"
                type="number"
                min="0"
                step="0.001"
                defaultValue={payment?.submittedAmount ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="certifiedAmount" className={labelCls}>Certified Amount</label>
              <input
                id="certifiedAmount"
                name="certifiedAmount"
                type="number"
                min="0"
                step="0.001"
                defaultValue={payment?.certifiedAmount ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="paidAmount" className={labelCls}>Paid Amount</label>
              <input
                id="paidAmount"
                name="paidAmount"
                type="number"
                min="0"
                step="0.001"
                defaultValue={payment?.paidAmount ?? ''}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="status" className={labelCls}>Status</label>
            <select id="status" name="status" defaultValue={payment?.status ?? 'DRAFT'} className={inputCls}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              maxLength={5000}
              defaultValue={payment?.remarks ?? ''}
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
            form="payment-form"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : mode === 'add' ? 'Add Payment' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
