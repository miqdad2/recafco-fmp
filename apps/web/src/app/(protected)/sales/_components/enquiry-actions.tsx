'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { CalendarPlus, MessageSquarePlus, Flag, X } from 'lucide-react';
import type { SalesStatus } from '@/lib/sales-api';
import type { SalesFormState } from '../_lib/form-state';
import { STATUS_LABELS, STATUS_ORDER, RECORDABLE_ACTIVITY } from '../_lib/sales-format';
import { addActivityAction, addFollowUpAction, changeStatusAction } from '../actions';
import { BTN_PRIMARY, BTN_SECONDARY, Field, FormMessage, INPUT_CLASS } from './sales-ui';

/**
 * FMP-SALES-01 — the three things a manager does on an enquiry besides editing it: add a follow-up,
 * record a meeting or note, change the status. One panel open at a time, shown right under the buttons.
 * Rendered only for users with sales.update (the API enforces it again).
 */
type Panel = 'followUp' | 'activity' | 'status' | null;

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
    <button type="submit" disabled={pending} className={BTN_PRIMARY}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

interface Props {
  enquiryId: string;
  status: SalesStatus;
  today: string;
}

export function EnquiryActions({ enquiryId, status, today }: Props): React.JSX.Element {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Exclude<Panel, null>): void => setPanel((cur) => (cur === p ? null : p));
  const btn = (p: Exclude<Panel, null>, label: string, Icon: typeof Flag): React.JSX.Element => (
    <button type="button" onClick={() => toggle(p)} aria-expanded={panel === p} aria-controls={`panel-${p}`} className={BTN_SECONDARY}>
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {btn('followUp', 'Add Follow-up', CalendarPlus)}
        {btn('activity', 'Record Meeting / Note', MessageSquarePlus)}
        {btn('status', 'Update Status', Flag)}
      </div>
      {panel && (
        <div id={`panel-${panel}`} className="mt-4 rounded-xl border border-border-strong bg-surface-secondary/50 p-5">
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setPanel(null)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus">
              <X className="size-4" aria-hidden="true" /> Close
            </button>
          </div>
          {panel === 'followUp' && <FollowUpPanel enquiryId={enquiryId} today={today} />}
          {panel === 'activity' && <ActivityPanel enquiryId={enquiryId} today={today} />}
          {panel === 'status' && <StatusPanel enquiryId={enquiryId} current={status} today={today} />}
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

function ActivityPanel({ enquiryId, today }: { enquiryId: string; today: string }): React.JSX.Element {
  const [state, action] = useActionState<SalesFormState, FormData>(addActivityAction.bind(null, enquiryId), IDLE);
  useRefreshOnSuccess(state);
  return (
    <form action={action} key={state.ok ?? state.error ?? 'a'} className="space-y-4">
      <FormMessage error={state.error} ok={state.ok} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ac-type" label="What happened?" required>
          <select id="ac-type" name="type" defaultValue={state.values['type'] ?? 'OFFICE_MEETING'} className={INPUT_CLASS}>
            {RECORDABLE_ACTIVITY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field id="ac-date" label="Date" required>
          <input id="ac-date" name="activityDate" type="date" max={today} defaultValue={state.values['activityDate'] ?? today} className={INPUT_CLASS} />
        </Field>
      </div>
      <Field id="ac-notes" label="Notes" required errors={state.fieldErrors['notes']}>
        <textarea id="ac-notes" name="notes" rows={4} maxLength={5000} defaultValue={state.values['notes'] ?? ''}
          placeholder="What was discussed or agreed?" className={`${INPUT_CLASS} resize-y`} />
      </Field>
      <Submit label="Save" />
    </form>
  );
}

function StatusPanel({ enquiryId, current, today }: { enquiryId: string; current: SalesStatus; today: string }): React.JSX.Element {
  const [state, action] = useActionState<SalesFormState, FormData>(changeStatusAction.bind(null, enquiryId), IDLE);
  useRefreshOnSuccess(state);
  const [choice, setChoice] = useState<SalesStatus>(((state.values['status'] as SalesStatus | undefined) ?? current));
  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} ok={state.ok} />
      <fieldset>
        <legend className="mb-2 text-base font-semibold text-text-primary">Choose the new status</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map((s) => (
            <label
              key={s}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-base font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
                choice === s ? 'border-accent bg-surface font-semibold text-text-primary ring-1 ring-accent' : 'border-border-strong bg-surface text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              <input type="radio" name="status" value={s} checked={choice === s} onChange={() => setChoice(s)} className="size-4 accent-[#c62828]" />
              {STATUS_LABELS[s]}{s === current && <span className="text-xs font-normal text-text-muted">(now)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      {choice === 'LOST' && (
        <Field id="st-reason" label="Why is it not proceeding?" required errors={state.fieldErrors['reason']}>
          <input id="st-reason" name="reason" type="text" maxLength={1000} defaultValue={state.values['reason'] ?? ''}
            placeholder="A short reason, for example: client chose another supplier" className={INPUT_CLASS} />
        </Field>
      )}
      {choice === 'WON' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="st-awarded" label="Confirmed value (KWD) — optional" hint="The real value, if known. The estimate is not changed." errors={state.fieldErrors['awardedValue']}>
            <input id="st-awarded" name="awardedValue" type="text" inputMode="decimal" defaultValue={state.values['awardedValue'] ?? ''} placeholder="0.000" className={INPUT_CLASS} />
          </Field>
          <Field id="st-won" label="Confirmation date" errors={state.fieldErrors['wonDate']}>
            <input id="st-won" name="wonDate" type="date" defaultValue={state.values['wonDate'] ?? today} className={INPUT_CLASS} />
          </Field>
        </div>
      )}
      {choice !== 'LOST' && choice !== 'WON' && (
        <Field id="st-note" label="Note (optional)">
          <input id="st-note" name="reason" type="text" maxLength={1000} defaultValue={state.values['reason'] ?? ''} className={INPUT_CLASS} />
        </Field>
      )}
      <Submit label="Update Status" />
    </form>
  );
}
