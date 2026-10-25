'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, CalendarClock } from 'lucide-react';
import type { SalesFormState } from '../_lib/form-state';
import { completeFollowUpAction, rescheduleFollowUpAction } from '../actions';
import { BTN_DONE, BTN_NEUTRAL, BTN_STATUS, Field, FormMessage, INPUT_CLASS } from './sales-ui';

/**
 * FMP-SALES-01 — Mark Completed / Reschedule for one pending follow-up. Completing keeps the record
 * (it moves to "Completed"); rescheduling keeps the old record (shown as "Replaced") and creates a new
 * one. Rendered only for users with sales.update.
 */
const IDLE: SalesFormState = { error: null, fieldErrors: {}, values: {}, ok: null };

function Submit({ label, className = BTN_DONE }: { label: string; className?: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

interface Props {
  followUpId: string;
  enquiryId: string;
  today: string;
  /** Smaller buttons for list rows. */
  compact?: boolean;
  /** Wording of the main button (same label everywhere). */
  completeLabel?: string;
  /** Hide Reschedule (the dashboard card offers just Mark Completed). */
  allowReschedule?: boolean;
}

export function FollowUpActions({ followUpId, enquiryId, today, compact, completeLabel = 'Mark Completed', allowReschedule = true }: Props): React.JSX.Element {
  const [open, setOpen] = useState<'complete' | 'reschedule' | null>(null);
  const [doneState, doneAction] = useActionState<SalesFormState, FormData>(completeFollowUpAction.bind(null, followUpId, enquiryId), IDLE);
  const [moveState, moveAction] = useActionState<SalesFormState, FormData>(rescheduleFollowUpAction.bind(null, followUpId, enquiryId), IDLE);
  const router = useRouter();
  useEffect(() => {
    if (doneState.ok || moveState.ok) router.refresh();
  }, [doneState, moveState, router]);
  void compact; // one size for every button (48px); the prop is kept so existing call sites stay valid

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(open === 'complete' ? null : 'complete')} aria-expanded={open === 'complete'}
          className={BTN_DONE}>
          <CheckCircle2 className="size-5" aria-hidden="true" /> {completeLabel}
        </button>
        {allowReschedule && <button type="button" onClick={() => setOpen(open === 'reschedule' ? null : 'reschedule')} aria-expanded={open === 'reschedule'}
          className={BTN_STATUS}>
          <CalendarClock className="size-5" aria-hidden="true" /> Reschedule
        </button>}
      </div>

      {open === 'complete' && (
        <form action={doneAction} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <FormMessage error={doneState.error} />
          <Field id={`done-${followUpId}`} label="What happened? (optional)" errors={doneState.fieldErrors['completionNotes']}>
            <input id={`done-${followUpId}`} name="completionNotes" type="text" maxLength={2000} defaultValue={doneState.values['completionNotes'] ?? ''} className={INPUT_CLASS} />
          </Field>
          <div className="flex flex-wrap gap-2"><Submit label="Confirm — Mark Completed" /><button type="button" onClick={() => setOpen(null)} className={BTN_NEUTRAL}>Cancel</button></div>
        </form>
      )}
      {open === 'reschedule' && (
        <form action={moveAction} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <FormMessage error={moveState.error} />
          <Field id={`move-${followUpId}`} label="New date" required errors={moveState.fieldErrors['followUpDate']}>
            <input id={`move-${followUpId}`} name="followUpDate" type="date" min={today} defaultValue={moveState.values['followUpDate'] ?? ''} className={INPUT_CLASS} />
          </Field>
          <div className="flex flex-wrap gap-2"><Submit label="Confirm — Move Follow-up" className={BTN_STATUS} /><button type="button" onClick={() => setOpen(null)} className={BTN_NEUTRAL}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
