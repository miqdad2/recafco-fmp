'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCloseoutRequestAction } from '../../../../actions';
import { inputCls, labelCls } from '../../../../_components/contract-form-fields';

interface Props {
  contractId: string;
}

/**
 * CM-67 — restyled from the original closeout-request-form.tsx (CM-33),
 * same createCloseoutRequestAction unchanged. No "Save Draft" button — the
 * real backend always creates a request directly as SUBMITTED (see
 * contract-closeout.service.ts's own comment: "DRAFT flow intentionally
 * skipped"), so a Save Draft action would have nothing real to call.
 */
export function ContractCloseoutRequestForm({ contractId }: Props): React.JSX.Element {
  const router = useRouter();
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    setClientError(null);
    setIsSaving(true);
    try {
      const result = await createCloseoutRequestAction(contractId, { error: null }, formData);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      form.reset();
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Closeout request submitted but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to submit closeout request:', err);
      setClientError('Failed to submit closeout request. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {clientError && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          {clientError}
        </div>
      )}

      <div>
        <label htmlFor="closeoutSummary" className={labelCls}>
          Closeout Summary <span className="text-error">*</span>
        </label>
        <textarea
          id="closeoutSummary"
          name="closeoutSummary"
          rows={3}
          required
          maxLength={5000}
          placeholder="Summarize why this contract is ready to be closed…"
          className={`${inputCls} resize-y`}
        />
      </div>

      <div>
        <label htmlFor="requestedRemarks" className={labelCls}>Requested Remarks</label>
        <textarea
          id="requestedRemarks"
          name="requestedRemarks"
          rows={2}
          maxLength={5000}
          placeholder="Any additional context for the reviewer…"
          className={`${inputCls} resize-y`}
        />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
      >
        {isSaving ? 'Submitting…' : 'Submit Closeout Review'}
      </button>
    </form>
  );
}
