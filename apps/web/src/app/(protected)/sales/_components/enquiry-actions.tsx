'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { CalendarPlus, X } from 'lucide-react';
import type { SalesFormState } from '../_lib/form-state';
import { addFollowUpAction } from '../actions';
import { BTN_ADD, BTN_NEUTRAL, Field, FormMessage, INPUT_CLASS } from './sales-ui';
import { AddActivityButton } from './add-activity-button';

/**
 * FMP-SALES-01 — the three things a manager does on an enquiry besides editing it: add a follow-up,
 * record a meeting or note, change the status. One panel open at a time, shown right under the buttons.
 * Rendered only for users with sales.update (the API enforces it again).
 */
type Panel = 'followUp' | null;

const IDLE: SalesFormState = { error: null, fieldErrors: {}, values: {}, ok: null };

/** After a change that stays on the page, re-read the server data so the history/status shown is current. */
function useRefreshOnSuccess(state: SalesFormState): void {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
}

function Submit({ label }: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={BTN_ADD}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

interface Props {
  enquiryId: string;
  companyName: string;
  today: string;
  /** The Change Status button (one status editor), placed right after Add Activity. */
  statusSlot?: React.ReactNode;
}

export function EnquiryActions({ enquiryId, companyName, today, statusSlot }: Props): React.JSX.Element {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Exclude<Panel, null>): void => setPanel((cur) => (cur === p ? null : p));
  const btn = (p: Exclude<Panel, null>, label: string, Icon: typeof CalendarPlus): React.JSX.Element => (
    <button type="button" onClick={() => toggle(p)} aria-expanded={panel === p} aria-controls={`panel-${p}`} className={BTN_NEUTRAL}>
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <AddActivityButton enquiryId={enquiryId} companyName={companyName} today={today} />
        {statusSlot}
        {btn('followUp', 'Add Follow-up', CalendarPlus)}
      </div>
      {panel && (
        <div id={`panel-${panel}`} className="mt-4 rounded-xl border border-border-strong bg-surface-secondary/50 p-5">
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setPanel(null)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus">
              <X className="size-4" aria-hidden="true" /> Close
            </button>
          </div>
          {panel === 'followUp' && <FollowUpPanel enquiryId={enquiryId} today={today} />}
        </div>
      )}
    </div>
  );
}

function FollowUpPanel({ enquiryId, today }: { enquiryId: string; today: string }): React.JSX.Element {
  const [state, action] = useActionState<SalesFormState, FormData>(addFollowUpAction.bind(null, enquiryId), IDLE);
  useRefreshOnSuccess(state);
  return (
    <form action={action} key={state.ok ?? state.error ?? 'f'} className="space-y-4">
      <FormMessage error={state.error} ok={state.ok} />
      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <Field id="fu-date" label="Follow-up date" required errors={state.fieldErrors['followUpDate']}>
          <input id="fu-date" name="followUpDate" type="date" min={today} defaultValue={state.values['followUpDate'] ?? ''} className={INPUT_CLASS} />
        </Field>
        <Field id="fu-notes" label="What needs to be done?" errors={state.fieldErrors['notes']}>
          <input id="fu-notes" name="notes" type="text" maxLength={2000} defaultValue={state.values['notes'] ?? ''} placeholder="For example: call to confirm the quotation" className={INPUT_CLASS} />
        </Field>
      </div>
      <Submit label="Schedule Follow-up" />
    </form>
  );
}
