'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronDown, Loader2, TriangleAlert } from 'lucide-react';
import type { SalesStatus } from '@/lib/sales-api';
import { changeEnquiryStatusAction } from '../actions';
import { STATUS_BADGE, STATUS_LABELS, STATUS_ORDER } from '../_lib/sales-format';
import { BTN_PRIMARY, BTN_SECONDARY, Field, INPUT_CLASS, StatusBadge } from './sales-ui';

/**
 * FMP-SALES-04 — change an enquiry's status from where it is shown (All Enquiries row, enquiry page, dashboard card).
 * Viewers get the plain badge. Editors get a labelled dropdown; picking a value only proposes it - nothing is saved
 * until "Save Status". Not Proceeding and Confirmed open the same confirmation the Update Status panel asks for
 * (reason / optional value and date) with the enquiry and the proposed status in view. The save goes through the
 * existing status API (rules, history, audit); the status the user saw is sent so a change made by someone else is
 * refused instead of overwritten. Changing a status never creates a contract.
 */
const norm = (s: SalesStatus): SalesStatus => (s === 'CONTACTED' ? 'MEETING_DONE' : s);

/** Does an enquiry with this status still belong in a list filtered by `filter` (the API's status filter value)? */
export function matchesStatusFilter(filter: string | undefined, status: SalesStatus): boolean {
  if (!filter) return true;
  if (filter === 'open') return status !== 'WON' && status !== 'LOST';
  return filter.split(',').includes(status);
}

type Note = { kind: 'ok' | 'error' | 'leaves'; text: string; conflict?: boolean };

interface Props {
  enquiryId: string;
  enquiryNumber: string;
  companyName: string;
  status: SalesStatus;
  canEdit: boolean;
  today: string;
  /** Status filter of the list this control sits in ('' / undefined = none), used to explain when it no longer matches. */
  filter?: string | undefined;
  /** Name of that filter for the explanation, e.g. "Active". */
  filterLabel?: string | undefined;
}

export function EnquiryStatusControl({ enquiryId, enquiryNumber, companyName, status, canEdit, today, filter, filterLabel }: Props): React.JSX.Element {
  const uid = useId();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  // The dialog also fires "close" after a successful save; that must not reset the message/selection.
  const closedBySave = useRef(false);
  const [saved, setSaved] = useState<SalesStatus>(status);
  const [choice, setChoice] = useState<SalesStatus>(norm(status));
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState('');
  const [awarded, setAwarded] = useState('');
  const [wonDate, setWonDate] = useState(today);

  // The record changed underneath (page refreshed): follow it unless a save is in flight.
  useEffect(() => {
    if (busy.current) return;
    setSaved(status);
    setChoice(norm(status));
  }, [status]);

  if (!canEdit) return <StatusBadge status={status} />;

  const dirty = choice !== norm(saved);
  const needsConfirm = choice === 'LOST' || choice === 'WON';

  function resetToSaved(): void {
    setChoice(norm(saved));
    setNote(null);
    setFieldErrors({});
    setReason('');
    setAwarded('');
    setWonDate(today);
  }

  function cancel(): void {
    if (busy.current) return;
    dialog.current?.close();
    resetToSaved();
  }

  async function submit(): Promise<void> {
    if (busy.current || !dirty) return; // repeated clicks while saving, or nothing to save
    busy.current = true;
    setPending(true);
    setNote(null);
    setFieldErrors({});
    try {
      const res = await changeEnquiryStatusAction(enquiryId, {
        status: choice, expectedStatus: saved, reason, awardedValue: awarded, wonDate,
      });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors);
        if (res.error || Object.keys(res.fieldErrors).length === 0) {
          setNote({
            kind: 'error',
            conflict: res.conflict,
            text: res.conflict
              ? `Not saved. ${res.error ?? ''} Reload to see the latest status.`
              : `Not saved. ${res.error ?? 'Please try again.'} The status is still ${STATUS_LABELS[saved]}; your choice was kept so you can try again.`,
          });
        }
        return;
      }
      if (dialog.current?.open) {
        closedBySave.current = true;
        dialog.current.close();
      }
      const next = choice;
      setSaved(next);
      setReason('');
      setAwarded('');
      setWonDate(today);
      if (!matchesStatusFilter(filter, next)) {
        // Keep the row on screen long enough to say why it is going; the list is refreshed from the notice.
        setNote({ kind: 'leaves', text: `Status updated to ${STATUS_LABELS[next]}. It no longer matches the “${filterLabel ?? 'selected'}” filter and will leave this list when it is updated.` });
      } else {
        setNote({ kind: 'ok', text: 'Status updated' });
        router.refresh();
        window.setTimeout(() => setNote((n) => (n?.kind === 'ok' ? null : n)), 6000);
      }
    } catch {
      setNote({ kind: 'error', text: `Not saved. The connection failed. The status is still ${STATUS_LABELS[saved]}; your choice was kept so you can try again.` });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function onSaveClick(): void {
    if (!dirty || busy.current) return;
    if (needsConfirm) {
      setNote(null);
      dialog.current?.showModal();
    } else {
      void submit();
    }
  }

  const selectId = `${uid}-status`;
  const savedTone = STATUS_BADGE[norm(saved)];
  const proposed = STATUS_LABELS[choice];

  return (
    <div className="min-w-0" data-status-control={enquiryId}>
      <label htmlFor={selectId} className="mb-1 block text-base font-semibold text-text-secondary">Status</label>
      <div className="relative w-full max-w-64 min-w-48">
        <select
          id={selectId} value={choice} disabled={pending}
          onChange={(e) => { setChoice(e.target.value as SalesStatus); setNote(null); setFieldErrors({}); }}
          aria-describedby={dirty ? `${uid}-hint` : undefined}
          className={`min-h-12 w-full cursor-pointer appearance-none rounded-lg border-2 py-2 pl-4 pr-11 text-lg font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${savedTone}`}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s} className="bg-white font-medium text-slate-900">{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-6 -translate-y-1/2 text-text-primary" aria-hidden="true" />
      </div>

      {dirty && (
        <div className="mt-2">
          <p id={`${uid}-hint`} className="mb-2 text-base text-text-secondary">Saved status: <span className="font-semibold text-text-primary">{STATUS_LABELS[saved]}</span>. Change to <span className="font-semibold text-text-primary">{proposed}</span>? Not saved yet.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSaveClick} disabled={pending} className={`${BTN_PRIMARY} !min-h-12 !px-5`}>
              {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Saving…</> : 'Save Status'}
            </button>
            <button type="button" onClick={cancel} disabled={pending} className={`${BTN_SECONDARY} !min-h-12 !px-5`}>Cancel</button>
          </div>
        </div>
      )}

      <div aria-live="polite" role="status">
        {note?.kind === 'ok' && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-base font-semibold text-green-900">
            <CheckCircle2 className="size-5" aria-hidden="true" /> {note.text}
          </p>
        )}
        {note?.kind === 'leaves' && (
          <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-base text-amber-950">
            <p className="font-semibold">{note.text}</p>
            <button type="button" onClick={() => { setNote(null); router.refresh(); }} className={`${BTN_SECONDARY} mt-2 !min-h-12`}>Update list</button>
          </div>
        )}
        {note?.kind === 'error' && (
          <div role="alert" className="mt-2 rounded-lg border border-error bg-error-light px-3 py-2 text-base text-error">
            <p className="flex items-start gap-2 font-semibold"><TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> <span>{note.text}</span></p>
            {note.conflict && <button type="button" onClick={() => { setNote(null); router.refresh(); }} className={`${BTN_SECONDARY} mt-2 !min-h-12`}>Reload</button>}
          </div>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-title`}
        onClose={() => {
          if (closedBySave.current) { closedBySave.current = false; return; }
          if (!busy.current) resetToSaved();
        }}
        className="m-auto max-h-[94vh] w-[min(94vw,36rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-slate-900/55"
      >
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4 p-6">
          <div>
            <h2 id={`${uid}-title`} className="text-2xl font-extrabold">Confirm status change</h2>
            <p className="mt-2 break-words text-lg font-semibold text-text-primary">{companyName}</p>
            <p className="text-base text-text-secondary">{enquiryNumber}</p>
            <p className="mt-2 text-lg">
              <span className="text-text-secondary">From</span> <span className="font-semibold">{STATUS_LABELS[saved]}</span>{' '}
              <span className="text-text-secondary">to</span> <span className="font-bold">{proposed}</span>
            </p>
          </div>
          {choice === 'LOST' && (
            <Field id={`${uid}-reason`} label="Why is it not proceeding?" required errors={fieldErrors['reason']}>
              <input id={`${uid}-reason`} type="text" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="A short reason, for example: client chose another supplier" className={INPUT_CLASS} autoFocus />
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
          {note?.kind === 'error' && (
            <div role="alert" className="rounded-lg border border-error bg-error-light px-3 py-2 text-base font-semibold text-error">{note.text}</div>
          )}
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <button type="button" onClick={cancel} disabled={pending} className={BTN_SECONDARY}>Cancel</button>
            <button type="submit" disabled={pending} className={BTN_PRIMARY}>
              {pending ? 'Saving…' : `Confirm — ${proposed}`}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
