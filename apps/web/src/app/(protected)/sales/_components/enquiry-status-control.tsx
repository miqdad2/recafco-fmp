'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronDown, Flag, Loader2, TriangleAlert, X } from 'lucide-react';
import type { SalesStatus } from '@/lib/sales-api';
import { changeEnquiryStatusAction } from '../actions';
import { STATUS_LABELS, STATUS_ORDER } from '../_lib/sales-format';
import { BTN_DONE, BTN_NEUTRAL, BTN_STATUS, Field, INPUT_CLASS, StatusBadge } from './sales-ui';

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

/** Tab / Shift+Tab stay inside the popup (same behaviour as the Add Activity and New Enquiry popups). */
function keepFocusInside(e: React.KeyboardEvent<HTMLDialogElement>): void {
  if (e.key !== 'Tab') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
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
  const [confirmNotes, setConfirmNotes] = useState('');
  const [wonDate, setWonDate] = useState(today);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const [dropUp, setDropUp] = useState(false);

  // The status menu closes on Escape or a click/tap outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: MouseEvent | TouchEvent): void => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', esc);
    };
  }, [menuOpen]);

  // Opening the menu (by mouse or keyboard) puts the keyboard cursor on its first status.
  useEffect(() => {
    if (menuOpen) menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  }, [menuOpen]);

  // The record changed underneath (page refreshed): follow it unless a save is in flight.
  useEffect(() => {
    if (busy.current) return;
    setSaved(status);
  }, [status]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!canEdit) return null;

  function reset(): void {
    setChoice('');
    setError(null);
    setFieldErrors({});
    setReason('');
    setConfirmNotes('');
    setWonDate(today);
  }

  /** Picking a status from the menu only proposes it: the confirmation popup opens with it selected, nothing is saved yet. */
  function openEditor(preselect: SalesStatus): void {
    reset();
    setChoice(preselect);
    setOutcome(null);
    setMenuOpen(false);
    dialog.current?.showModal();
  }

  function cancel(): void {
    if (busy.current) return;
    dialog.current?.close();
  }

  async function save(): Promise<void> {
    if (busy.current || choice === '' || choice === norm(saved)) return; // repeated clicks, or nothing different chosen
    if (choice === 'WON') {
      // The Confirmation Date is today in Kuwait unless changed; it can be earlier (the client agreed some days ago), never later.
      if (!wonDate) { setFieldErrors({ wonDate: ['Please choose the confirmation date.'] }); return; }
      if (wonDate > today) { setFieldErrors({ wonDate: ['The confirmation date cannot be in the future.'] }); return; }
    }
    if (choice === 'LOST' && !reason.trim()) {
      setFieldErrors({ reason: ['Please give a short reason why it is not proceeding.'] });
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await changeEnquiryStatusAction(enquiryId, { status: choice, expectedStatus: saved, reason, confirmationNotes: confirmNotes, wonDate });
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
        setOutcome({ kind: 'leaves', text: `${next === 'WON' ? 'Enquiry confirmed.' : `Status updated to ${STATUS_LABELS[next]}.`} It no longer matches the “${filterLabel ?? 'selected'}” filter, so it will leave this list when you close this message.` });
      } else {
        dialog.current?.close();
        setToast(next === 'WON' ? 'Enquiry confirmed.' : 'Status updated');
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
      <div ref={wrap} className="relative inline-block">
        <button
          type="button"
          onClick={() => {
            // Open upwards when the menu would run off the bottom of the window and there is more room above.
            const r = wrap.current?.getBoundingClientRect();
            if (r) {
              const need = options.length * 48 + 16;
              setDropUp(window.innerHeight - r.bottom < need && r.top > window.innerHeight - r.bottom);
            }
            setMenuOpen((v) => !v);
          }}
          ref={trigger}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Change Status for ${companyName}`}
          className={BTN_STATUS}
          data-status-control={enquiryId}
        >
          <Flag className="size-5 shrink-0" aria-hidden="true" /> Change Status
          <ChevronDown className={`size-5 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {menuOpen && (
          <ul
            ref={menu}
            onKeyDown={(e) => {
              // Arrow keys / Home / End move between the statuses; Tab leaves the menu (it closes with the button's focus restored).
              const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []);
              const at = items.indexOf(document.activeElement as HTMLElement);
              const go = (i: number): void => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
              if (e.key === 'ArrowDown') go(at + 1);
              else if (e.key === 'ArrowUp') go(at - 1);
              else if (e.key === 'Home') go(0);
              else if (e.key === 'End') go(items.length - 1);
              else if (e.key === 'Tab') setMenuOpen(false);
            }}
            role="menu" aria-label={`Choose a new status for ${companyName}`} className={`absolute left-0 z-40 w-72 max-w-[85vw] overflow-y-auto rounded-lg border-2 border-slate-500 bg-white py-1 shadow-xl max-h-[70vh] ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
            {options.map((x) => (
              <li key={x} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openEditor(x)}
                  className="flex min-h-12 w-full items-center px-4 py-2 text-left text-lg font-semibold text-slate-900 hover:bg-amber-100 focus:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                >
                  {STATUS_LABELS[x]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-title`}
        onKeyDown={keepFocusInside}
        onClose={() => {
          // Closing after a "left the list" notice refreshes the list; any other close just forgets the draft.
          if (outcome) router.refresh();
          setOutcome(null);
          reset();
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) cancel();
        }}
        className="m-auto max-h-[94vh] w-[min(94vw,34rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-slate-900/55"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id={`${uid}-title`} className="text-2xl font-extrabold">{choice === 'WON' && !outcome ? 'Confirm Enquiry' : 'Change Status'}</h2>
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
            <div className={choice === 'WON' ? 'hidden' : undefined}>
              <label htmlFor={`${uid}-choose`} className="mb-1.5 block text-lg font-semibold">Choose Status</label>
              <div className="relative">
                <select
                  id={`${uid}-choose`}
                  value={choice}
                  disabled={pending}
                  onChange={(e) => { setChoice(e.target.value as SalesStatus | ''); setError(null); setFieldErrors({}); }}
                  className="min-h-14 w-full cursor-pointer appearance-none rounded-lg border-2 border-slate-500 bg-white py-2 pl-4 pr-12 text-xl font-semibold text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:opacity-60"
                >
                  <option value="">Choose Status…</option>
                  {options.map((x) => (
                    <option key={x} value={x}>{STATUS_LABELS[x]}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-6 -translate-y-1/2 text-slate-900" aria-hidden="true" />
              </div>
            </div>

            {choice !== '' && choice !== 'WON' && (
              <p className="text-lg">From <span className="font-semibold">{STATUS_LABELS[saved]}</span> to <span className="font-bold">{proposed}</span></p>
            )}
            {choice === 'LOST' && (
              <Field id={`${uid}-reason`} label="Why is it not proceeding?" required errors={fieldErrors['reason']}>
                <input id={`${uid}-reason`} type="text" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A short reason, for example: client chose another supplier" className={INPUT_CLASS} autoFocus />
              </Field>
            )}
            {choice === 'WON' && (
              <>
                <p className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-xl font-semibold text-green-950">The client has agreed to proceed.</p>
                <Field id={`${uid}-won`} label="Confirmation Date" required errors={fieldErrors['wonDate']}>
                  <input id={`${uid}-won`} type="date" value={wonDate} max={today} onChange={(e) => setWonDate(e.target.value)} autoFocus aria-invalid={!!fieldErrors['wonDate']} className={`${INPUT_CLASS} h-14 max-w-64 text-lg`} />
                </Field>
                <Field id={`${uid}-notes`} label="Confirmation Notes (optional)" errors={fieldErrors['confirmationNotes']}>
                  <textarea id={`${uid}-notes`} rows={3} maxLength={1000} value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder="For example: confirmed by phone with the project manager" className={`${INPUT_CLASS} resize-y text-lg`} />
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
              <button type="submit" disabled={pending || choice === ''} className={choice === 'WON' ? BTN_DONE : BTN_STATUS}>
                {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Saving…</> : choice === 'WON' ? 'Save Confirmation' : 'Save Status'}
              </button>
            </div>
          </form>
        )}
      </dialog>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-5 py-4 text-lg font-semibold text-green-900 shadow-lg">
          <CheckCircle2 className="size-6 shrink-0 text-green-700" aria-hidden="true" /> {toast}
        </div>
      )}
    </>
  );
}
