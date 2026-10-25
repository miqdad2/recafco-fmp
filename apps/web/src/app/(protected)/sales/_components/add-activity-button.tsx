'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { addActivityEntryAction } from '../actions';
import { BTN_ADD, BTN_NEUTRAL, Field, INPUT_CLASS } from './sales-ui';

/**
 * FMP-SALES-05 — "+ Add Activity": one popup, shared by the enquiry page, All Enquiries and the dashboard cards.
 * Three things only: the date (today in Kuwait, an earlier day is allowed), what happened (free text), and an
 * optional next follow-up. No category, subject, contact or status. One request id is made per popup so a retry
 * after a dropped connection never adds a second entry; nothing is lost when a save fails.
 */
const TEXT_AREA = `${INPUT_CLASS} min-h-44 resize-y text-lg leading-relaxed`;

/** A random id that also works on plain-http intranet pages (crypto.randomUUID needs a secure context). */
function newRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Tab / Shift+Tab stay inside the popup. */
function keepFocusInside(e: React.KeyboardEvent<HTMLDialogElement>): void {
  if (e.key !== 'Tab') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

interface Props {
  enquiryId: string;
  companyName: string;
  /** Today's date in Kuwait (YYYY-MM-DD), from the server. */
  today: string;
  label?: string;
  className?: string;
}

export function AddActivityButton({ enquiryId, companyName, today, label = 'Add Activity', className = BTN_ADD }: Props): React.JSX.Element {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);
  const requestId = useRef('');
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [withFollowUp, setWithFollowUp] = useState(false);
  const [nextDate, setNextDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  function show(): void {
    requestId.current = newRequestId();
    setDate(today);
    setNotes('');
    setWithFollowUp(false);
    setNextDate('');
    setError(null);
    setFieldErrors({});
    setOpen(true);
    dialog.current?.showModal();
    // Put the cursor in the text box on a desktop; on a phone or tablet leave the keyboard closed until it is tapped.
    window.setTimeout(() => {
      if (window.matchMedia('(pointer: fine)').matches) textBox.current?.focus();
      else title.current?.focus();
    }, 0);
  }

  function close(): void {
    if (busy.current) return;
    dialog.current?.close();
  }

  // Keep the page behind the popup from scrolling while it is open.
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  // Revealing the follow-up date moves the cursor to it (the button that was pressed disappears).
  useEffect(() => {
    if (withFollowUp) document.getElementById('act-next')?.focus();
  }, [withFollowUp]);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 6000);
    return () => window.clearTimeout(t);
  }, [saved]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (busy.current) return; // repeated clicks
    const errors: Record<string, string[]> = {};
    if (!date) errors['activityDate'] = ['Please choose the date.'];
    else if (date > today) errors['activityDate'] = ['The date cannot be in the future. To plan something for later, set a Next Follow-up.'];
    if (!notes.trim()) errors['notes'] = ['Please describe what happened.'];
    if (withFollowUp && !nextDate) errors['nextFollowUpDate'] = ['Please choose the follow-up date, or choose “No follow-up”.'];
    else if (withFollowUp && nextDate < today) errors['nextFollowUpDate'] = ['The follow-up date cannot be before today.'];
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    busy.current = true;
    setPending(true);
    try {
      const res = await addActivityEntryAction(enquiryId, {
        activityDate: date, notes, ...(withFollowUp ? { nextFollowUpDate: nextDate } : {}), requestId: requestId.current,
      });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors);
        setError(res.error ? `Not saved. ${res.error} What you typed is still here.` : 'Not saved. Please check the highlighted fields.');
        return;
      }
      busy.current = false; // allow close() below
      dialog.current?.close();
      setSaved(true);
      router.refresh();
    } catch {
      setError('Not saved. The connection failed. What you typed is still here; please press Save Activity again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const err = (k: string): string[] | undefined => fieldErrors[k];

  return (
    <>
      <button type="button" onClick={show} className={className} aria-haspopup="dialog" aria-label={`Add Activity for ${companyName}`}>
        <Plus className="size-5 shrink-0" aria-hidden="true" /> {label}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`act-title-${enquiryId}`}
        onClose={() => setOpen(false)}
        onKeyDown={keepFocusInside}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto max-h-[94vh] w-[min(94vw,40rem)] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-slate-900/55 open:flex open:flex-col"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 id={`act-title-${enquiryId}`} ref={title} tabIndex={-1} className="text-2xl font-extrabold tracking-tight focus:outline-none sm:text-3xl">Add Activity</h2>
            <p className="mt-1 break-words text-lg font-semibold text-text-primary">{companyName}</p>
          </div>
          <button
            type="button" onClick={close} aria-label="Close"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        {open && (
          <form onSubmit={(e) => void submit(e)} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {error && <div role="alert" className="rounded-lg border border-error bg-error-light px-4 py-3 text-lg font-medium text-error">{error}</div>}
              <Field id="act-date" label="Activity Date" required errors={err('activityDate')}>
                <input
                  id="act-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)}
                  aria-invalid={!!err('activityDate')} className={`${INPUT_CLASS} h-14 max-w-64 text-lg`}
                />
              </Field>
              <Field id="act-notes" label="What happened?" required errors={err('notes')}>
                <textarea
                  id="act-notes" ref={textBox} value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} maxLength={5000}
                  placeholder="Client visited our office. Discussed the requirements and requested drawings."
                  aria-required="true" aria-invalid={!!err('notes')} className={TEXT_AREA}
                />
              </Field>
              {withFollowUp ? (
                <div className="rounded-xl border border-border bg-surface-secondary/50 p-4">
                  <Field id="act-next" label="Next Follow-up Date" errors={err('nextFollowUpDate')}>
                    <input
                      id="act-next" type="date" value={nextDate} min={today} onChange={(e) => setNextDate(e.target.value)}
                      aria-invalid={!!err('nextFollowUpDate')} className={`${INPUT_CLASS} h-14 max-w-64 text-lg`}
                    />
                  </Field>
                  <button type="button" onClick={() => { setWithFollowUp(false); setNextDate(''); }} className="mt-3 min-h-12 rounded-lg px-2 text-lg font-semibold text-text-secondary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    No follow-up
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setWithFollowUp(true)} className={`${BTN_NEUTRAL}`}>
                  <CalendarPlus className="size-5" aria-hidden="true" /> Set Next Follow-up
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface-secondary/40 px-6 py-4">
              <button type="button" onClick={close} disabled={pending} className={`${BTN_NEUTRAL} min-w-32`}>Cancel</button>
              <button type="submit" disabled={pending} className={`${BTN_ADD} min-w-44`}>
                {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Saving…</> : 'Save Activity'}
              </button>
            </div>
          </form>
        )}
      </dialog>

      {saved && (
        <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-5 py-4 text-lg font-semibold text-green-900 shadow-lg">
          <CheckCircle2 className="size-6 shrink-0 text-green-700" aria-hidden="true" />
          <span className="flex-1">Activity saved</span>
          <button type="button" onClick={() => setSaved(false)} aria-label="Dismiss" className="rounded-md p-1 hover:bg-green-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
