'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, ChevronDown, Flag, Loader2, Lock, Plus, TriangleAlert, X } from 'lucide-react';
import type { SalesCustomStatus, SalesStatus } from '@/lib/sales-api';
import { addCustomStatusAction, changeEnquiryStatusAction } from '../actions';
import { CUSTOM_STATUS_PREFIX, customStatusFilter, matchesStatusFilter, STATUS_LABELS, STATUS_ORDER, statusKey } from '../_lib/sales-format';
import { BTN_DONE, BTN_NEUTRAL, BTN_STATUS, Field, INPUT_CLASS, StatusBadge } from './sales-ui';
import { useCustomStatuses } from './custom-statuses';

/**
 * FMP-SALES-04 / 08 — the ONE status editor. The saved status is shown elsewhere as a plain badge ("Current Status");
 * this is the amber "Change Status" button that opens a compact popup: the company, the current status, the other
 * statuses to pick from, the fields Not Proceeding (reason) and Confirmed (optional value and date) need, then
 * Save Status / Cancel. Nothing is saved by choosing; Save Status stays unavailable until a different status is chosen.
 * The save goes through the existing status API (rules, history, audit); the status the user saw is sent so a change
 * made by someone else is refused instead of overwritten. Changing a status never creates a contract.
 *
 * FMP-SALES-18 — the menu also lists the custom (in-progress) statuses management has added, and ends with a separated
 * "+ Add New Status", which opens a small popup (Status Name, Save & Apply / Cancel). The API creates the status and
 * applies it to this enquiry in one transaction, with the same restrictions as any other status change.
 * Statuses are handled by key: the system code, or "custom:<id>".
 */
const NAME_MAX = 60;
const norm = (s: string): string => (s === 'CONTACTED' ? 'MEETING_DONE' : s);
const isCustomKey = (k: string): boolean => k.startsWith(CUSTOM_STATUS_PREFIX);

interface Props {
  enquiryId: string;
  enquiryNumber: string;
  companyName: string;
  status: SalesStatus;
  /** FMP-SALES-18 — the enquiry's custom status (when status is CUSTOM). */
  customStatus?: SalesCustomStatus | null | undefined;
  /** Only users with sales.update get the button; everyone else gets nothing (the badge is shown by the parent). */
  canEdit: boolean;
  today: string;
  /** Status filter of the list this sits in ('' / undefined = none), to explain when the enquiry no longer matches it. */
  filter?: string | undefined;
  /** Name of that filter for the explanation, e.g. "Active". */
  filterLabel?: string | undefined;
  /** FMP-SALES-19 — 'buttons': every status as a visible button under a "Set Status" heading (enquiry page). Default 'menu'. */
  layout?: 'menu' | 'buttons';
  /** FMP-SALES-19 — when the status cannot be changed (e.g. linked to a contract): the short reason shown instead of buttons. */
  lockedReason?: string | null | undefined;
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

export function EnquiryStatusControl({ enquiryId, enquiryNumber, companyName, status, customStatus, canEdit, today, filter, filterLabel, layout = 'menu', lockedReason }: Props): React.JSX.Element | null {
  const uid = useId();
  const router = useRouter();
  const known = useCustomStatuses();
  const dialog = useRef<HTMLDialogElement>(null);
  const addDialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [saved, setSaved] = useState<string>(statusKey(status, customStatus));
  // Custom statuses this control has just created (the shared list catches up when the page refreshes).
  const [fresh, setFresh] = useState<SalesCustomStatus[]>([]);
  const [choice, setChoice] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [wonDate, setWonDate] = useState(today);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [addOutcome, setAddOutcome] = useState<Outcome>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // The button that opened a popup; focus goes back to it when the popup closes (status buttons, or the menu trigger).
  const returnTo = useRef<HTMLElement | null>(null);
  const restoreFocus = (): void => {
    const el = returnTo.current;
    (el && el.isConnected ? el : trigger.current)?.focus();
  };
  const menu = useRef<HTMLUListElement>(null);
  const [dropUp, setDropUp] = useState(false);

  const customs: SalesCustomStatus[] = [...known, ...fresh.filter((f) => !known.some((k) => k.id === f.id))];
  if (customStatus && !customs.some((c) => c.id === customStatus.id)) customs.push(customStatus);
  const customOf = (key: string): SalesCustomStatus | null => (isCustomKey(key) ? customs.find((c) => customStatusFilter(c.id) === key) ?? null : null);
  const labelOf = (key: string): string => customOf(key)?.name ?? STATUS_LABELS[key as SalesStatus] ?? 'Unknown status';
  const codeOf = (key: string): SalesStatus => (isCustomKey(key) ? 'CUSTOM' : (key as SalesStatus));

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
  const incoming = statusKey(status, customStatus);
  useEffect(() => {
    if (busy.current) return;
    setSaved(incoming);
  }, [incoming]);

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
  function openEditor(preselect: string): void {
    reset();
    setChoice(preselect);
    setOutcome(null);
    setMenuOpen(false);
    dialog.current?.showModal();
  }

  /** FMP-SALES-18 — "+ Add New Status": the name popup, focused on its one field. */
  function openAdd(): void {
    setMenuOpen(false);
    setNewName('');
    setError(null);
    setFieldErrors({});
    setAddOutcome(null);
    addDialog.current?.showModal();
    window.setTimeout(() => nameInput.current?.focus(), 0);
  }

  function cancel(): void {
    if (busy.current) return;
    dialog.current?.close();
  }

  function cancelAdd(): void {
    if (busy.current) return;
    addDialog.current?.close();
  }

  /** What the user was looking at, so a change made by someone else in the meantime is refused, not overwritten. */
  function expected(): { expectedStatus: string; expectedCustomStatusId: string | null } {
    const c = customOf(saved);
    return { expectedStatus: codeOf(saved), expectedCustomStatusId: c ? c.id : null };
  }

  function afterSaved(next: string, message: string, inDialog: 'status' | 'add'): void {
    setSaved(next);
    if (!matchesStatusFilter(filter, next)) {
      // Say why the enquiry is about to leave this list; the list is refreshed when this message is closed.
      const note: Outcome = { kind: 'leaves', text: `${message} It no longer matches the “${filterLabel ?? 'selected'}” filter, so it will leave this list when you close this message.` };
      if (inDialog === 'status') setOutcome(note);
      else setAddOutcome(note);
    } else {
      (inDialog === 'status' ? dialog : addDialog).current?.close();
      setToast(message);
      router.refresh();
    }
  }

  async function save(): Promise<void> {
    if (busy.current || choice === '' || norm(choice) === norm(saved)) return; // repeated clicks, or nothing different chosen
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
      const target = customOf(choice);
      const res = await changeEnquiryStatusAction(enquiryId, { status: codeOf(choice), ...(target ? { customStatusId: target.id } : {}), ...expected(), reason, confirmationNotes: confirmNotes, wonDate });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors);
        if (res.error || Object.keys(res.fieldErrors).length === 0) {
          setError({
            conflict: res.conflict,
            text: res.conflict
              ? `Not saved. ${res.error ?? ''} Reload to see the latest status.`
              : `Not saved. ${res.error ?? 'Please try again.'} The status is still ${labelOf(saved)}; your choice was kept so you can try again.`,
          });
        }
        return;
      }
      afterSaved(choice, choice === 'WON' ? 'Enquiry confirmed.' : `Status updated to ${labelOf(choice)}.`, 'status');
    } catch {
      setError({ conflict: false, text: `Not saved. The connection failed. The status is still ${labelOf(saved)}; your choice was kept so you can try again.` });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function saveNew(): Promise<void> {
    if (busy.current) return; // a second click while saving does nothing
    const name = newName.replace(/\s+/g, ' ').trim();
    if (!name) { setFieldErrors({ name: ['Please enter a status name.'] }); nameInput.current?.focus(); return; }
    if (name.length > NAME_MAX) { setFieldErrors({ name: [`Please keep the status name to ${NAME_MAX} characters or fewer.`] }); nameInput.current?.focus(); return; }
    busy.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await addCustomStatusAction(enquiryId, { name, ...expected() });
      if (!res.ok || !res.status) {
        setFieldErrors(res.fieldErrors);
        if (res.error || Object.keys(res.fieldErrors).length === 0) {
          setError({ conflict: res.conflict, text: res.conflict ? `Not saved. ${res.error ?? ''} Reload to see the latest status.` : `Not saved. ${res.error ?? 'Please try again.'}` });
        }
        nameInput.current?.focus(); // the typed name is kept so it can be corrected
        return;
      }
      setFresh((list) => [...list, res.status!]);
      afterSaved(customStatusFilter(res.status.id), 'Status added and applied.', 'add');
    } catch {
      setError({ conflict: false, text: 'Not saved. The connection failed. Your status name was kept so you can try again.' });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const systemOptions = STATUS_ORDER.filter((x) => x !== norm(saved)) as string[];
  const customOptions = customs.map((c) => customStatusFilter(c.id)).filter((k) => k !== saved);
  const options = [...systemOptions, ...customOptions];
  const proposed = choice ? labelOf(choice) : '';
  const savedBadge = <StatusBadge status={codeOf(saved)} customStatus={customOf(saved)} />;
  const menuItemClass = 'flex min-h-12 w-full items-center px-4 py-2 text-left text-lg font-semibold text-slate-900 [overflow-wrap:anywhere] hover:bg-amber-100 focus:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus';

  // FMP-SALES-19 — the enquiry page's "Set Status" buttons: the same statuses, in the same order as the menu (system
  // in-progress statuses, then custom ones, then Confirmed and Not Proceeding), from the same definitions and custom-status list.
  const buttonKeys: string[] = [
    ...(STATUS_ORDER.filter((x) => x !== 'WON' && x !== 'LOST') as string[]),
    ...customs.map((c) => customStatusFilter(c.id)),
    'WON',
    'LOST',
  ];
  const tone = (key: string, current: boolean): string => {
    if (key === 'WON') return current ? 'border-green-800 bg-green-700 text-white' : 'border-green-600 bg-green-50 text-green-900 hover:bg-green-100';
    if (key === 'LOST') return current ? 'border-slate-800 bg-slate-700 text-white' : 'border-slate-400 bg-slate-100 text-slate-900 hover:bg-slate-200';
    return current ? 'border-blue-800 bg-blue-700 text-white' : 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100';
  };
  const STATUS_BTN = 'inline-flex min-h-12 max-w-full items-center gap-2 rounded-lg border-2 px-4 py-2 text-left text-lg font-semibold leading-snug [overflow-wrap:anywhere] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-focus focus-visible:ring-offset-2';

  const statusButtons = (
    <section aria-labelledby={`${uid}-set`} data-status-buttons={enquiryId}>
      <h2 id={`${uid}-set`} className="text-xl font-bold text-text-primary">Set Status</h2>
      {lockedReason ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-lg text-slate-900" data-status-locked>
          <Lock className="mt-1 size-5 shrink-0 text-slate-700" aria-hidden="true" /> {lockedReason}
        </p>
      ) : (
        <>
          <p className="mt-1 text-base text-text-secondary">Choose the status that fits now. Any status can be chosen.</p>
          <div role="group" aria-labelledby={`${uid}-set`} className="mt-3 flex flex-wrap gap-2">
            {buttonKeys.map((k) => {
              const current = norm(k) === norm(saved);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={current}
                  aria-label={current ? `${labelOf(k)} (current status)` : `Set status to ${labelOf(k)}`}
                  onClick={(e) => {
                    if (current || pending) return; // the current status sends nothing and adds no history
                    returnTo.current = e.currentTarget;
                    openEditor(k);
                  }}
                  className={`${STATUS_BTN} ${tone(k, current)} ${current ? 'cursor-default' : ''}`}
                  data-status-button={k}
                  data-current={current ? 'true' : undefined}
                >
                  {current && <Check className="size-5 shrink-0" aria-hidden="true" />}
                  <span>{labelOf(k)}</span>
                  {current && <span className="rounded bg-white/20 px-1.5 text-base font-bold">Current</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={(e) => { returnTo.current = e.currentTarget; openAdd(); }}
              className={`${STATUS_BTN} border-dashed border-blue-700 bg-white text-blue-800 hover:bg-blue-50`}
              data-add-status
            >
              <Plus className="size-5 shrink-0" aria-hidden="true" /> Add New Status
            </button>
          </div>
        </>
      )}
    </section>
  );

  return (
    <>
      {layout === 'buttons' ? statusButtons : (
      <div ref={wrap} className="relative inline-block">
        <button
          type="button"
          onClick={() => {
            // Open upwards when the menu would run off the bottom of the window and there is more room above.
            const r = wrap.current?.getBoundingClientRect();
            if (r) {
              const need = (options.length + 1) * 48 + 32;
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
                <button type="button" role="menuitem" onClick={() => { returnTo.current = null; openEditor(x); }} className={menuItemClass} data-status-option={x}>
                  {labelOf(x)}
                </button>
              </li>
            ))}
            <li role="separator" className="my-1 border-t-2 border-slate-300" />
            <li role="none">
              <button type="button" role="menuitem" onClick={() => { returnTo.current = null; openAdd(); }} className={`${menuItemClass} gap-2 text-blue-900`} data-add-status>
                <Plus className="size-5 shrink-0" aria-hidden="true" /> Add New Status
              </button>
            </li>
          </ul>
        )}
      </div>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-title`}
        onKeyDown={keepFocusInside}
        onClose={() => {
          // Closing after a "left the list" notice refreshes the list; any other close just forgets the draft.
          if (outcome) router.refresh();
          setOutcome(null);
          reset();
          restoreFocus();
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
              <span className="text-text-secondary">Current Status:</span> {savedBadge}
            </p>
            <div className={choice === 'WON' ? 'hidden' : undefined}>
              <label htmlFor={`${uid}-choose`} className="mb-1.5 block text-lg font-semibold">Choose Status</label>
              <div className="relative">
                <select
                  id={`${uid}-choose`}
                  value={choice}
                  disabled={pending}
                  onChange={(e) => { setChoice(e.target.value); setError(null); setFieldErrors({}); }}
                  className="min-h-14 w-full cursor-pointer appearance-none rounded-lg border-2 border-slate-500 bg-white py-2 pl-4 pr-12 text-xl font-semibold text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:opacity-60"
                >
                  <option value="">Choose Status…</option>
                  {options.map((x) => (
                    <option key={x} value={x}>{labelOf(x)}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-6 -translate-y-1/2 text-slate-900" aria-hidden="true" />
              </div>
            </div>

            {choice !== '' && choice !== 'WON' && (
              <p className="break-words text-lg">From <span className="font-semibold">{labelOf(saved)}</span> to <span className="font-bold">{proposed}</span></p>
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

      {/* FMP-SALES-18 — "+ Add New Status" popup. */}
      <dialog
        ref={addDialog}
        aria-labelledby={`${uid}-add-title`}
        aria-describedby={`${uid}-add-help`}
        onKeyDown={keepFocusInside}
        onClose={() => {
          if (addOutcome) router.refresh();
          setAddOutcome(null);
          setError(null);
          setFieldErrors({});
          restoreFocus();
        }}
        onClick={(e) => {
          if (e.target === addDialog.current) cancelAdd();
        }}
        className="m-auto max-h-[94vh] w-[min(94vw,32rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-slate-900/55"
        data-add-status-dialog
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id={`${uid}-add-title`} className="text-2xl font-extrabold">Add New Status</h2>
            <p className="mt-1 break-words text-lg font-semibold">{companyName}</p>
          </div>
          <button type="button" onClick={cancelAdd} aria-label="Close" className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        {addOutcome ? (
          <div className="space-y-4 px-6 py-5">
            <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-lg font-semibold text-amber-950">
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-amber-800" aria-hidden="true" /> {addOutcome.text}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => addDialog.current?.close()} className={BTN_NEUTRAL}>Close and update list</button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void saveNew(); }} noValidate className="space-y-4 px-6 py-5">
            <Field id={`${uid}-name`} label="Status Name" required errors={fieldErrors['name']}>
              <input
                ref={nameInput}
                id={`${uid}-name`}
                type="text"
                maxLength={NAME_MAX}
                value={newName}
                // Read-only (not disabled) while saving, so focus can return to it straight after an error.
                readOnly={pending}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="For example, Waiting for Site Visit"
                aria-invalid={!!fieldErrors['name']}
                autoComplete="off"
                className={`${INPUT_CLASS} text-lg`}
                data-new-status-name
              />
            </Field>
            <p id={`${uid}-add-help`} className="text-base text-text-secondary">This status means the enquiry is still in progress.</p>

            <div aria-live="polite" role="status" className="empty:hidden">
              {error && (
                <div role="alert" className="rounded-lg border border-error bg-error-light px-4 py-3 text-base text-error">
                  <p className="flex items-start gap-2 font-semibold"><TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> <span>{error.text}</span></p>
                  {error.conflict && <button type="button" onClick={() => { addDialog.current?.close(); router.refresh(); }} className={`${BTN_NEUTRAL} mt-2`}>Reload</button>}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-1">
              <button type="button" onClick={cancelAdd} disabled={pending} className={BTN_NEUTRAL}>Cancel</button>
              <button type="submit" disabled={pending} className={BTN_STATUS} data-save-new-status>
                {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Saving…</> : 'Save & Apply'}
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
