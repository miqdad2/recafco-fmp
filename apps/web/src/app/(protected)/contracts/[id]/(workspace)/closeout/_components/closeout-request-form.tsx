'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '../../../../actions';
import { createCloseoutRequestAction } from '../../../../actions';
import { inputCls, labelCls } from '../../../../_components/contract-form-fields';

interface Props {
  contractId: string;
}

export function CloseoutRequestForm({ contractId }: Props): React.JSX.Element {
  const router = useRouter();
  const action = createCloseoutRequestAction.bind(null, contractId);
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(action, { error: null });
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && !state.error) {
      submittedRef.current = false;
      router.refresh();
    }
  }, [state, isPending, router]);

  return (
    <form action={formAction} onSubmit={() => { submittedRef.current = true; }} className="space-y-4">
      {state.error && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="closeoutSummary" className={labelCls}>
          Closeout Summary <span className="text-danger">*</span>
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
        disabled={isPending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
      >
        {isPending ? 'Submitting…' : 'Submit Request'}
      </button>
    </form>
  );
}
