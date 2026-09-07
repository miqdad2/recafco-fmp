'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { createPaymentAction, updatePaymentAction } from '../../actions';
import type { ContractPayment, ContractPaymentStatus } from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3 } from '../../_components/contract-form-fields';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_OPTIONS,
  PAYMENT_TERM_OTHER,
  resolvePaymentTermSelection,
  resolvePaymentTermValue,
  computeRemainingAmount,
  suggestPaymentStatus,
  validatePaymentFormValues,
} from '../../_lib/contract-payment-detail-helpers';

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
  /**
   * CM-58B — 'register' (default) is the module-level register's exact
   * original behavior: a Contract picker in Add mode, and the Certified
   * Amount field. 'contractDetail' is for the Contract Detail Payments tab,
   * which is always scoped to one already-known contract: no Contract
   * picker (the single contract is submitted as a hidden field and shown
   * as a read-only "Adding payment for" / project name / reference number
   * block instead — CM-58C), no Certified Amount field (that concept isn't
   * part of this unit's approved design), and four labels renamed to match
   * this page's own column wording (Invoice Amount / Payment Due Date /
   * Received On / Received Amount). The underlying field `name`
   * attributes — and therefore the create/update payload — never change
   * between variants; only what's shown and how it's labeled does.
   */
  variant?: 'register' | 'contractDetail';
}

// CM-58C — reuses the same manager-friendly labels already established for
// the Payments tab's own status badges/filter (contract-payment-detail-helpers.ts)
// instead of showing the raw backend enum ("Draft") — DRAFT was confusing
// to managers, since a payment in that state simply hasn't been submitted
// yet ("Pending"). CERTIFIED is kept (existing records can still have that
// status) but moved to the end of the list, after the six status values
// this task lists as preferred, so it reads as the least prominent option
// without being hidden or renamed.
const STATUS_OPTIONS = (
  ['DRAFT', 'SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'CERTIFIED'] as const
).map((value) => ({ value, label: PAYMENT_STATUS_LABELS[value] }));

// CM-70A — read-only calculated field, same established pattern as the BOQ
// register's own "Calculated: ..." cells (contract-boq-register-table.tsx) —
// a plain styled <div>, never a disabled <input>, so it can never be
// mistaken for an editable/submittable form control.
const readOnlyCalcCls = 'rounded-md bg-surface-secondary px-3 py-2 text-sm text-right tabular-nums font-medium text-text-secondary';
const sectionLabelCls = 'text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1';

export function PaymentFormModal({ mode, contracts, payment, onClose, variant = 'register' }: Props): React.JSX.Element {
  const isContractDetail = variant === 'contractDetail';
  const amountLabel = isContractDetail ? 'Invoice Amount' : 'Submitted Amount';
  const dueDateLabel = isContractDetail ? 'Payment Due Date' : 'Due Date';
  const paidDateLabel = isContractDetail ? 'Received On' : 'Paid Date';
  const paidAmountLabel = isContractDetail ? 'Received Amount' : 'Paid Amount';
  // CM-58C — the single known contract for the contract-detail variant,
  // shown as a small read-only context block instead of plain text.
  const contractContext = isContractDetail ? (mode === 'add' ? contracts?.[0] : payment?.contract) : undefined;
  const router = useRouter();

  // CM-70A — controlled only where live reactivity is genuinely needed
  // (Remaining Amount preview + auto-suggested Status + the Payment Term
  // dropdown/"Other" split). Invoice Number/Invoice Date/Payment Due
  // Date/Received On/Payment No./Remarks stay plain uncontrolled fields
  // (defaultValue) — their values are only ever needed at submit time,
  // read directly from the real FormData, exactly like every other field
  // in this app's many other server-action forms.
  const [submittedAmount, setSubmittedAmount] = useState(payment?.submittedAmount ?? '');
  const [paidAmount, setPaidAmount] = useState(payment?.paidAmount ?? '');
  const [status, setStatus] = useState<ContractPaymentStatus>(payment?.status ?? 'DRAFT');
  const initialTerm = resolvePaymentTermSelection(payment?.paymentTerm);
  const [paymentTermChoice, setPaymentTermChoice] = useState<string>(initialTerm.choice);
  const [otherPaymentTerm, setOtherPaymentTerm] = useState(initialTerm.other);
  const [clientError, setClientError] = useState<string | null>(null);
  // Bug fix: this modal previously relied on useActionState's own isPending/
  // state plus a submittedRef + useEffect to detect a successful save and
  // close the modal. For some payments that effect never fired even though
  // the backend insert had already succeeded, leaving the button stuck on
  // "Saving…" and the modal open. Replaced with an explicit, manually
  // controlled save flow: isSaving is set true only for the duration of the
  // actual request (in a try/finally, so it can never get stuck regardless
  // of what happens inside), and a successful response always closes the
  // modal immediately — never gated on a separate effect run.
  const [isSaving, setIsSaving] = useState(false);

  const invoiceAmountNum = submittedAmount.trim() ? Number(submittedAmount) : null;
  const receivedAmountNum = paidAmount.trim() ? Number(paidAmount) : null;
  // CM-70A — the live preview always uses Invoice Amount vs Received Amount
  // only (never Certified Amount, even in the register variant) — this
  // matches the task's own literal "Remaining Amount = Invoice Amount −
  // Received Amount" formula exactly, is never saved/submitted anywhere
  // (the backend keeps computing its own real outstandingAmount, which may
  // legitimately differ once a payment is certified), and never risks
  // looking inconsistent with what the user just typed into these two
  // specific fields.
  const remainingAmount = computeRemainingAmount(invoiceAmountNum, receivedAmountNum);

  // CM-70A — auto-set the suggested status whenever either amount changes
  // (per this unit's own "Preferred: Auto-set status when amounts change"),
  // using the just-typed value directly rather than the not-yet-updated
  // state, so the suggestion is always based on the real, current pair of
  // numbers. A manual status the user picks afterward (SUBMITTED/CERTIFIED/
  // OVERDUE/CANCELLED — none of which are derivable from amounts alone)
  // survives until the next amount edit, exactly matching "allow manual
  // override only if existing business logic requires it".
  function handleInvoiceAmountChange(value: string): void {
    setSubmittedAmount(value);
    const invoice = value.trim() ? Number(value) : null;
    const suggested = suggestPaymentStatus(invoice, receivedAmountNum);
    if (suggested) setStatus(suggested);
  }

  function handleReceivedAmountChange(value: string): void {
    setPaidAmount(value);
    const received = value.trim() ? Number(value) : null;
    const suggested = suggestPaymentStatus(invoiceAmountNum, received);
    if (suggested) setStatus(suggested);
  }

  /**
   * Bug fix — explicit, manually-controlled save flow (see the isSaving
   * state comment above for why). Always preventDefault()s first, so the
   * browser's native form submission is never involved and there is no
   * dependency on useActionState's own transition/pending semantics.
   * Double-submit is prevented by bailing out immediately if a save is
   * already in flight; isSaving is only ever set inside the try/finally
   * below, so it always returns to false exactly once the request settles,
   * regardless of success, failure, or a thrown exception. A successful
   * response ALWAYS closes the modal immediately (never gated on a later
   * effect); router.refresh() is then attempted separately and its own
   * failure is only logged as a warning — the save itself already
   * succeeded and must not be treated as failed just because the list
   * couldn't refresh automatically.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    const errors = validatePaymentFormValues({
      invoiceNumber: (formData.get('invoiceNumber') as string | null) ?? '',
      invoiceDate: (formData.get('invoiceDate') as string | null) ?? '',
      dueDate: (formData.get('dueDate') as string | null) ?? '',
      paidDate: (formData.get('paidDate') as string | null) ?? '',
      invoiceAmount: submittedAmount,
      receivedAmount: paidAmount,
      status,
    });
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      return;
    }
    setClientError(null);

    setIsSaving(true);
    try {
      const result: ActionResult =
        mode === 'edit' && payment
          ? await updatePaymentAction(payment.id, payment.contractId, { error: null }, formData)
          : await createPaymentAction({ error: null }, formData);

      // Defensive: treat any response without a real error message as
      // success — covers a created/updated payment object, a bare success
      // marker, or (per actionFetch's own handling) an empty-but-OK (200/201)
      // response body.
      if (result?.error == null) {
        onClose();
        try {
          router.refresh();
        } catch (refreshError) {
          console.warn('Payment saved successfully, but refreshing the list failed. Refresh the page to see it.', refreshError);
        }
      } else {
        setClientError(result.error);
      }
    } catch (err) {
      console.error('Failed to save payment', err);
      setClientError('Payment could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const finalPaymentTerm = resolvePaymentTermValue(paymentTermChoice, otherPaymentTerm);

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

        <form id="payment-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {clientError && (
            <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
              {clientError}
            </div>
          )}

          {contractContext && (
            <div className="rounded-md border border-border bg-surface-secondary/50 px-3 py-2.5">
              <p className="text-xs text-text-muted">{mode === 'add' ? 'Adding payment for' : 'Payment for'}</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">{contractContext.title}</p>
              <p className="text-xs text-text-muted font-mono mt-0.5">{contractContext.referenceNumber}</p>
              {mode === 'add' && <input type="hidden" name="contractId" value={contractContext.id} />}
            </div>
          )}

          {mode === 'add' && !isContractDetail && (
            <div>
              <label htmlFor="contractId" className={labelCls}>
                Contract <span className="text-error">*</span>
              </label>
              <select id="contractId" name="contractId" required defaultValue="" className={inputCls}>
                <option value="" disabled>Select a contract…</option>
                {contracts?.map((c) => (
                  <option key={c.id} value={c.id}>{c.referenceNumber} — {c.title}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'edit' && !isContractDetail && (
            <div>
              <span className={labelCls}>Contract</span>
              <p className="text-sm text-text-primary">
                {payment?.contract.referenceNumber} — {payment?.contract.title}
              </p>
            </div>
          )}

          {/* Payment identity */}
          <p className={sectionLabelCls}>Payment Identity</p>
          <div className={gridCls3}>
            <div>
              <label htmlFor="paymentNo" className={labelCls}>Payment No.</label>
              <input
                id="paymentNo"
                name="paymentNo"
                type="text"
                maxLength={50}
                defaultValue={payment?.paymentNo ?? ''}
                placeholder="e.g. PAY-GRM-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="invoiceNumber" className={labelCls}>
                Invoice Number <span className="text-error">*</span>
              </label>
              <input
                id="invoiceNumber"
                name="invoiceNumber"
                type="text"
                maxLength={100}
                defaultValue={payment?.invoiceNumber ?? ''}
                placeholder="e.g. INV-GRM-ADV-001"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="paymentTermChoice" className={labelCls}>Payment Term</label>
              <select
                id="paymentTermChoice"
                value={paymentTermChoice}
                onChange={(e) => setPaymentTermChoice(e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>Select payment term</option>
                {PAYMENT_TERM_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value={PAYMENT_TERM_OTHER}>{PAYMENT_TERM_OTHER}</option>
              </select>
              {/* CM-70A — one clean string is always what gets submitted as
                  `paymentTerm`, whichever fixed option or free-text "Other"
                  value the user actually chose — the backend's real,
                  unchanged text column never sees the two-part UI. */}
              <input type="hidden" name="paymentTerm" value={finalPaymentTerm} />
            </div>
            {paymentTermChoice === PAYMENT_TERM_OTHER && (
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="otherPaymentTerm" className={labelCls}>Other payment term</label>
                <input
                  id="otherPaymentTerm"
                  type="text"
                  maxLength={100}
                  value={otherPaymentTerm}
                  onChange={(e) => setOtherPaymentTerm(e.target.value)}
                  placeholder="Describe the payment term"
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Dates */}
          <p className={sectionLabelCls}>Dates</p>
          <div className={gridCls3}>
            <div>
              <label htmlFor="invoiceDate" className={labelCls}>
                Invoice Date <span className="text-error">*</span>
              </label>
              <input
                id="invoiceDate"
                name="invoiceDate"
                type="date"
                defaultValue={payment?.invoiceDate ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="dueDate" className={labelCls}>
                {dueDateLabel} <span className="text-error">*</span>
              </label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={payment?.dueDate ?? ''}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="paidDate" className={labelCls}>
                {paidDateLabel}
                {(receivedAmountNum !== null && receivedAmountNum > 0) && <span className="text-error"> *</span>}
              </label>
              <input
                id="paidDate"
                name="paidDate"
                type="date"
                defaultValue={payment?.paidDate ?? ''}
                className={inputCls}
              />
            </div>
          </div>
          <p className="text-xs text-text-muted -mt-2">Use the calendar picker to avoid date format mistakes.</p>

          {/* Amounts */}
          <p className={sectionLabelCls}>Amounts</p>
          <div className={isContractDetail ? 'grid grid-cols-1 sm:grid-cols-3 gap-4' : gridCls3}>
            <div>
              <label htmlFor="submittedAmount" className={labelCls}>
                {amountLabel} <span className="text-error">*</span>
              </label>
              <input
                id="submittedAmount"
                name="submittedAmount"
                type="number"
                min="0"
                step="0.001"
                value={submittedAmount}
                onChange={(e) => handleInvoiceAmountChange(e.target.value)}
                placeholder="e.g. 8500.000"
                className={inputCls}
              />
            </div>
            {!isContractDetail && (
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
            )}
            <div>
              <label htmlFor="paidAmount" className={labelCls}>
                {paidAmountLabel} <span className="text-error">*</span>
              </label>
              <input
                id="paidAmount"
                name="paidAmount"
                type="number"
                min="0"
                step="0.001"
                value={paidAmount}
                onChange={(e) => handleReceivedAmountChange(e.target.value)}
                placeholder="e.g. 8500.000"
                className={inputCls}
              />
            </div>
            <div>
              <span className={labelCls}>Remaining Amount</span>
              <div className={readOnlyCalcCls} title="Calculated: Invoice Amount − Received Amount">
                {remainingAmount !== null ? remainingAmount.toFixed(3) : '—'}
              </div>
            </div>
          </div>

          {/* Status */}
          <p className={sectionLabelCls}>Status</p>
          <div>
            <label htmlFor="status" className={labelCls}>Status</label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContractPaymentStatus)}
              className={inputCls}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              Suggested automatically from Invoice Amount and Received Amount — change it manually only for Submitted, Certified, Overdue, or Cancelled.
            </p>
          </div>

          {/* Remarks */}
          <p className={sectionLabelCls}>Remarks</p>
          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              maxLength={5000}
              defaultValue={payment?.remarks ?? ''}
              placeholder="Add payment notes, client reference, or follow-up details."
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
            disabled={isSaving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : mode === 'add' ? 'Add Payment' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
