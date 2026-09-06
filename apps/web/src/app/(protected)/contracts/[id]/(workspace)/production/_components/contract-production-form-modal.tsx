'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { ActionResult } from '../../../../actions';
import { updateProductionAction } from '../../../../actions';
import type { ContractProductionItem, ContractBoqProductionStatus } from '@/lib/contracts-api';
import { inputCls, labelCls, InfoBox } from '../../../../_components/contract-form-fields';
import {
  PRODUCTION_STATUS_OPTIONS,
  computeStockNotDelivered,
  computeRemainingToCast,
  computePercentOfTotal,
  suggestProductionStatus,
  validateProductionFormValues,
  formatQty,
} from '../../../../_lib/contract-production-helpers';

interface Props {
  contractId: string;
  item: ContractProductionItem;
  onClose: () => void;
}

/** A clean, at-most-3-decimal starting value for a controlled number input — avoids ever seeding it with floating-point noise (e.g. "80.10000000000001") that could otherwise fail the input's own step="0.001" validity check. */
function toInputValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(value * 1000) / 1000);
}

/**
 * CM-59 — Add / Update Production modal. Item Description and Total Qty are
 * always read-only (Total Qty is the contract's own BOQ Qty/Area — this
 * modal never overwrites it). Stock / Not Delivered, Remaining to Cast and
 * Progress % are live client-side previews computed from the in-progress
 * Casted/Delivered values via the same pure formulas the backend uses
 * (contract-production-helpers.ts mirrors contract-boq-production.service.ts
 * exactly) — never submitted themselves, always recomputed server-side on
 * save.
 * CM-70B — audited first: the backend already returns a real, honest 0 (not
 * undefined/NaN) for both Casted/Produced and Delivered on an item that has
 * never been touched (contract-boq-production.service.ts's own toNum(...) ??
 * 0 fallback), and neither field ever carried a `required` attribute or any
 * border-color-driven validity styling — no genuine "red border on a valid
 * 0" bug was found in this component. What WAS missing: any field-level
 * guidance that 0 is the correct, expected Delivered value for a
 * newly-started item, and any pre-submit validation beyond the backend's
 * own (already correct) assertProductionAmountsValid cross-field checks.
 * Added: explicit helper text, a live status suggestion (same "auto-suggest
 * the amount-derivable statuses, never lock the field, let DELAYED stay
 * manual-only" pattern as CM-70A's Payment modal), and a single client-side
 * validation pass that blocks submission with a visible message instead of
 * ever relying on a silently-dimmed button or a bare red border.
 */
export function ContractProductionFormModal({ contractId, item, onClose }: Props): React.JSX.Element {
  const router = useRouter();
  const action = updateProductionAction.bind(null, item.id, contractId);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const submittedRef = useRef(false);

  const [producedQty, setProducedQty] = useState(toInputValue(item.producedQty));
  const [deliveredQty, setDeliveredQty] = useState(toInputValue(item.deliveredQty));
  const [status, setStatus] = useState<ContractBoqProductionStatus>(item.status);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (submittedRef.current && !isPending && !state.error) {
      submittedRef.current = false;
      onClose();
      router.refresh();
    }
  }, [state, isPending, onClose, router]);

  // CM-70B — auto-set the suggested status whenever either quantity changes
  // (mirrors CM-70A's Payment modal exactly), using the just-typed value
  // directly rather than not-yet-updated state. DELAYED is never suggested
  // — a manual pick of it survives until the next quantity edit, matching
  // "do not force status... allow manual override where the pattern
  // supports it".
  function handleProducedChange(value: string): void {
    setProducedQty(value);
    const produced = value.trim() ? Number(value) : 0;
    const delivered = deliveredQty.trim() ? Number(deliveredQty) : 0;
    const suggested = suggestProductionStatus(item.totalQty, produced, delivered);
    if (suggested) setStatus(suggested);
  }

  function handleDeliveredChange(value: string): void {
    setDeliveredQty(value);
    const produced = producedQty.trim() ? Number(producedQty) : 0;
    const delivered = value.trim() ? Number(value) : 0;
    const suggested = suggestProductionStatus(item.totalQty, produced, delivered);
    if (suggested) setStatus(suggested);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    const errors = validateProductionFormValues({ totalQty: item.totalQty, producedQty, deliveredQty });
    if (errors.length > 0) {
      e.preventDefault();
      setClientError(errors.join(' '));
      return;
    }
    setClientError(null);
    submittedRef.current = true;
  }

  const producedPreview = parseFloat(producedQty);
  const deliveredPreview = parseFloat(deliveredQty);
  const produced = isNaN(producedPreview) ? 0 : producedPreview;
  const delivered = isNaN(deliveredPreview) ? 0 : deliveredPreview;
  const stockPreview = computeStockNotDelivered(produced, delivered);
  const remainingPreview = computeRemainingToCast(item.totalQty, produced);
  const progressPreview = Math.round(computePercentOfTotal(produced, item.totalQty));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="production-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,640px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <h2 id="production-form-title" className="text-lg font-semibold text-text-primary">Add / Update Production</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form id="production-form" action={formAction} onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {(clientError ?? state.error) && (
            <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
              {clientError ?? state.error}
            </div>
          )}

          <div className="rounded-md border border-border bg-surface-secondary/50 px-3 py-2.5">
            <p className="text-xs text-text-muted">Item Description</p>
            <p className="text-sm font-medium text-text-primary mt-0.5">{item.description}</p>
            {item.itemCode && <p className="text-xs text-text-muted font-mono mt-0.5">{item.itemCode}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={labelCls}>Total Qty</span>
              <p className="text-sm text-text-primary py-2">
                {formatQty(item.totalQty)} {item.unitOfMeasure ?? ''}
              </p>
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>Production Status</label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractBoqProductionStatus)}
                className={inputCls}
              >
                {PRODUCTION_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="producedQty" className={labelCls}>Casted / Produced</label>
              <input
                id="producedQty"
                name="producedQty"
                type="number"
                min="0"
                step="0.001"
                value={producedQty}
                onChange={(e) => handleProducedChange(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="deliveredQty" className={labelCls}>Delivered</label>
              <input
                id="deliveredQty"
                name="deliveredQty"
                type="number"
                min="0"
                step="0.001"
                value={deliveredQty}
                onChange={(e) => handleDeliveredChange(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <p className="text-xs text-text-muted -mt-2">
            Enter the quantity produced and the quantity already delivered. Remaining and progress are calculated automatically. Delivered is 0 when production has started but nothing has been delivered yet.
          </p>

          <div className="grid grid-cols-3 gap-4 rounded-md border border-border bg-surface-secondary/30 px-3 py-2.5">
            <div>
              <p className="text-xs text-text-muted">Stock / Not Delivered</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">{formatQty(stockPreview)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Remaining to Cast</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">{formatQty(remainingPreview)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Progress</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">{progressPreview}%</p>
            </div>
          </div>

          <InfoBox variant="subtle">
            Stock / Not Delivered, Remaining to Cast and Progress are calculated automatically from Casted / Produced and Delivered. Production Status is suggested automatically too — change it manually only for Delayed.
          </InfoBox>

          <div>
            <label htmlFor="remarks" className={labelCls}>Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              maxLength={5000}
              defaultValue={item.remarks ?? ''}
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
            form="production-form"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
