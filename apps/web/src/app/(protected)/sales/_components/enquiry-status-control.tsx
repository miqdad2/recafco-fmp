'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Flag, Loader2, TriangleAlert, X } from 'lucide-react';
import type { SalesStatus } from '@/lib/sales-api';
import { changeEnquiryStatusAction } from '../actions';
import { STATUS_LABELS, STATUS_ORDER } from '../_lib/sales-format';
import { BTN_NEUTRAL, BTN_STATUS, Field, INPUT_CLASS, StatusBadge } from './sales-ui';

/**
 * FMP-SALES-04 / 08 — the ONE status editor. The saved status is shown elsewhere as a plain badge ("Current Status");
 * this is the amber "Change Status" button that opens a compact popup: the company, the current status, the other
 * statuses to pick from, the fields Not Proceeding (reason) and Confirmed (optional value and date) need, then
 * Save Status / Cancel. Nothing is saved by choosing; Save Status stays unavailable until a different status is chosen.
 * The save goes through the existing status API (rules, history, audit); the status the user saw is sent so a change
 * made by someone else is refused instead of overwritten. Changing a status never creates a contract.
 */
const norm = (s: SalesStatus): SalesStatus => (s === 'CONTACTED' ? 'MEETING_DONE' : s);

/** Does an enquiry with this status still belong in a list filtered by `filter` (the API's status filter value)? */
export function matchesStatusFilter(filter: string | undefined, status: SalesStatus): boolean {
  if (!filter) return true;
  if (filter === 'open') return status !== 'WON' && status !== 'LOST';
  return filter.split(',').includes(status);
}

interface Props {
  enquiryId: string;
  enquiryNumber: string;
  companyName: string;
  status: SalesStatus;
  /** Only users with sales.update get the button; everyone else gets nothing (the badge is shown by the parent). */
  canEdit: boolean;
  today: string;
  /** Status filter of the list this sits in ('' / undefined = none), to explain when the enquiry no longer matches it. */
  filter?: string | undefined;
  /** Name of that filter for the explanation, e.g. "Active". */
  filterLabel?: string | undefined;
}

type Outcome = { kind: 'leaves'; text: string } | null;

export function EnquiryStatusControl({ enquiryId, enquiryNumber, companyName, status, canEdit, today, filter, filterLabel }: Props): React.JSX.Element | null {
  const uid = useId();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [saved, setSaved] = useState<SalesStatus>(status);
  const [choice, setChoice] = useState<SalesStatus | ''>('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState('');
  const [awarded, setAwarded] = useState('');
  const [wonDate, setWonDate] = useState(today);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [toast, setToast] = useState(false);

  // The record changed underneath (page refreshed): follow it unless a save is in flight.
  useEffect(() => {
    if (busy.current) return;
    setSaved(status);
  }, [status]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!canEdit) return null;

  function reset(): void {
    setChoice('');
    setError(null);
    setFieldErrors({});
    setReason('');
    setAwarded('');
    setWonDate(today);
  }

  function openEditor(): void {
    reset();
    setOutcome(null);
    dialog.current?.showModal();
  }

  function cancel(): void {
    if (busy.current) return;
    dialog.current?.close();
  }

  async function save(): Promise<void> {
    if (busy.current || choice === '' || choice === norm(saved)) return; // repeated clicks, or nothing different chosen
    if (choice === 'LOST' && !reason.trim()) {
      setFieldErrors({ reason: ['Please give a short reason why it is not proceeding.'] });
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await changeEnquiryStatusAction(enquiryId, { status: choice, expectedStatus: saved, reason, awardedValue: awarded, wonDate });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors);
        if (res.error || Object.keys(res.fieldErrors).length === 0) {
          setError({
            conflict: res.conflict,
            text: res.conflict
              ? `Not saved. ${res.error ?? ''} Reload to see the latest status.`
              : `Not saved. ${res.error ?? 'Please try again.'} The status is still ${STATUS_LABELS[saved]}; your choice was kept so you can try again.`,
          });
        }
        return;
      }
      const next = choice;
      setSaved(next);
      if (!matchesStatusFilter(filter, next)) {
        // Say why the enquiry is about to leave this list; the list is refreshed when this message is closed.
        setOutcome({ kind: 'leaves', text: `Status updated to ${STATUS_LABELS[next]}. It no longer matches the “${filterLabel ?? 'selected'}” filter, so it will leave this list when you close this message.` });
      } else {
        dialog.current?.close();
        setToast(true);
        router.refresh();
      }
    } catch {
      setError({ conflict: false, text: `Not saved. The connection failed. The status is still ${STATUS_LABELS[saved]}; your choice was kept so you can try again.` });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const options = STATUS_ORDER.filter((x) => x !== norm(saved));
  const proposed = choice ? STATUS_LABELS[choice] : '';

  return (
    <>
      <button type="button" onClick={openEditor} aria-haspopup="dialog" aria-label={`Change Status for ${companyName}`} className={BTN_STATUS} data-status-control={enquiryId}>
        <Flag className="size-5 shrink-0" aria-hidden="true" /> Change Status
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-title`}
        onClose={() => {
          // Closing after a "left the list" notice refreshes the list; any other close just forgets the draft.
          if (outcome) router.refresh();
          setOutcome(null);
          reset();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) cancel();
        }}
        className="m-auto max-h-[94vh] w-[min(94vw,34rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-slate-900/55"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id={`${uid}-title`} className="text-2xl font-extrabold">Change Status</h2>
            <p className="mt-1 break-words text-lg font-semibold">{companyName}</p>
            <p className="text-base text-text-secondary">{enquiryNumber}</p>
          </div>
          <button type="button" onClick={cancel} aria-label="Close" className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>

        {outcome ? (
          <div className="space-y-4 px-6 py-5">
            <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-lg font-semibold text-amber-950">
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-amber-800" aria-hidden="true" /> {outcome.text}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => dialog.current?.close()} className={BTN_NEUTRAL}>Close and update list</button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="space-y-4 px-6 py-5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
              <span className="text-text-secondary">Current Status:</span> <StatusBadge status={saved} />
            </p>
            <fieldset disabled={pending}>
              <legend className="mb-2 text-lg font-semibold">Change to</legend>
              <div className="space-y-2">
                {options.map((x) => (
                  <label
                    key={x}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-2 text-lg font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-focus ${
                      choice === x ? 'border-amber-700 bg-amber-100 text-slate-900' : 'border-slate-400 bg-white text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <input type="radio" name={`${uid}-status`} value={x} checked={choice === x} onChange={() => { setChoice(x); setError(null); setFieldErrors({}); }} className="size-5 accent-amber-700" />
                    {STATUS_LABELS[x]}
                  </label>
                ))}
              </div>
            </fieldset>

            {choice !== '' && (
              <p className="text-lg">From <span className="font-semibold">{STATUS_LABELS[saved]}</span> to <span className="font-bold">{proposed}</span></p>
            )}
            {choice === 'LOST' && (
              <Field id={`${uid}-reason`} label="Why is it not proceeding?" required errors={fieldErrors['reason']}>
                <input id={`${uid}-reason`} type="text" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A short reason, for example: client chose another supplier" className={INPUT_CLASS} autoFocus />
              </Field>
            )}
            {choice === 'WON' && (
              <>
                <p className="rounded-lg bg-surface-secondary px-4 py-3 text-base text-text-secondary">This records the enquiry as Confirmed. It does not create a contract.</p>
                <Field id={`${uid}-awarded`} label="Confirmed value (KWD) — optional" hint="The real value, if known. The estimate is not changed." errors={fieldErrors['awardedValue']}>
                  <input id={`${uid}-awarded`} type="text" inputMode="decimal" value={awarded} onChange={(e) => setAwarded(e.target.value)} placeholder="0.000" className={INPUT_CLASS} />
                </Field>
                <Field id={`${uid}-won`} label="Confirmation date" errors={fieldErrors['wonDate']}>
                  <input id={`${uid}-won`} type="date" value={wonDate} onChange={(e) => setWonDate(e.target.value)} className={INPUT_CLASS} />
                </Field>
              </>
            )}

            <div aria-live="polite" role="status" className="empty:hidden">
              {error && (
                <div role="alert" className="rounded-lg border border-error bg-error-light px-4 py-3 text-base text-error">
                  <p className="flex items-start gap-2 font-semibold"><TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> <span>{error.text}</span></p>
                  {error.conflict && <button type="button" onClick={() => { dialog.current?.close(); router.refresh(); }} className={`${BTN_NEUTRAL} mt-2`}>Reload</button>}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-1">
              <button type="button" onClick={cancel} disabled={pending} className={BTN_NEUTRAL}>Cancel</button>
              <button type="submit" disabled={pending || choice === ''} className={BTN_STATUS}>
                {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Saving…</> : 'Save Status'}
              </button>
            </div>
          </form>
        )}
      </dialog>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-5 py-4 text-lg font-semibold text-green-900 shadow-lg">
          <CheckCircle2 className="size-6 shrink-0 text-green-700" aria-hidden="true" /> Status updated
        </div>
      )}
    </>
  );
}
