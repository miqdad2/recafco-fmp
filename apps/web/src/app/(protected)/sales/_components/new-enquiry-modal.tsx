'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';
import type { SalesFormState } from '../_lib/form-state';
import { createEnquiryQuickAction } from '../actions';
import { BTN_PRIMARY, BTN_SECONDARY, Field, FormMessage, INPUT_CLASS } from './sales-ui';

/**
 * FMP-SALES-01C — "+ New Client Enquiry" as a centered popup, so a manager can save a client's details
 * during a meeting without leaving the page. Uses the native <dialog>: Esc closes it, focus stays inside
 * while it is open and goes back to the button afterwards. It also closes with Cancel, the X, or a click
 * outside. Only the seven essential fields are asked; everything else can be added later with Edit.
 * After a successful save the popup closes, the page behind it refreshes, and a confirmation appears.
 */
const IDLE: SalesFormState = { error: null, fieldErrors: {}, values: {}, ok: null, savedId: null };

function SaveButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-w-44 text-lg`}>
      {pending ? 'Saving…' : 'Save Enquiry'}
    </button>
  );
}

interface FormProps {
  onClose: () => void;
  onSaved: (id: string) => void;
}

function QuickForm({ onClose, onSaved }: FormProps): React.JSX.Element {
  const [state, action] = useActionState<SalesFormState, FormData>(createEnquiryQuickAction, IDLE);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (state.savedId && handled.current !== state.savedId) {
      handled.current = state.savedId;
      onSaved(state.savedId);
    }
  }, [state.savedId, onSaved]);

  const v = (k: string): string => state.values[k] ?? '';
  const err = (k: string): string[] | undefined => state.fieldErrors[k];
  // The form is re-mounted after a failed save so the refilled values replace what React reset.
  const key = JSON.stringify(state.fieldErrors) + (state.error ?? '');

  return (
    <form key={key} action={action} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 sm:px-8">
        <FormMessage error={state.error} />
        <Field id="q-company" label="Company/Client Name" required errors={err('companyName')}>
          <input
            id="q-company" name="companyName" type="text" autoFocus defaultValue={v('companyName')} maxLength={200} autoComplete="off"
            aria-required="true" aria-invalid={!!err('companyName')} aria-describedby={err('companyName') ? 'q-company-error' : undefined}
            className={`${INPUT_CLASS} h-14 text-lg`}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="q-person" label="Contact Person" errors={err('contactPerson')}>
            <input id="q-person" name="contactPerson" type="text" defaultValue={v('contactPerson')} maxLength={200} autoComplete="off" className={`${INPUT_CLASS} h-14 text-lg`} />
          </Field>
          <Field id="q-phone" label="Contact Number" errors={err('contactNumber')}>
            <input id="q-phone" name="contactNumber" type="tel" inputMode="tel" defaultValue={v('contactNumber')} maxLength={50} autoComplete="off" className={`${INPUT_CLASS} h-14 text-lg`} />
          </Field>
        </div>
        <Field id="q-scope" label="Scope of Work" required errors={err('scopeOfWork')}>
          <textarea
            id="q-scope" name="scopeOfWork" rows={4} defaultValue={v('scopeOfWork')} maxLength={10000}
            placeholder="What does the client need? For example: type of work, quantities, important requirements."
            aria-required="true" aria-invalid={!!err('scopeOfWork')} aria-describedby={err('scopeOfWork') ? 'q-scope-error' : undefined}
            className={`${INPUT_CLASS} min-h-32 resize-y text-lg`}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="q-value" label="Estimated Project Value (KWD)" hint="Leave blank if not known yet." errors={err('estimatedValue')}>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-text-secondary" aria-hidden="true">KWD</span>
              <input
                id="q-value" name="estimatedValue" type="text" inputMode="decimal" defaultValue={v('estimatedValue')} autoComplete="off" placeholder="0.000"
                aria-invalid={!!err('estimatedValue')} aria-describedby={err('estimatedValue') ? 'q-value-error' : 'q-value-hint'}
                className={`${INPUT_CLASS} h-14 pl-18 text-lg`}
              />
            </div>
          </Field>
          <Field id="q-next" label="Next Follow-up Date" errors={err('nextFollowUpDate')}>
            <input id="q-next" name="nextFollowUpDate" type="date" defaultValue={v('nextFollowUpDate')} className={`${INPUT_CLASS} h-14 text-lg`} />
          </Field>
        </div>
        <Field id="q-notes" label="Meeting Notes" errors={err('remarks')}>
          <textarea id="q-notes" name="remarks" rows={3} defaultValue={v('remarks')} maxLength={5000} className={`${INPUT_CLASS} resize-y text-lg`} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface-secondary/40 px-6 py-4 sm:px-8">
        <button type="button" onClick={onClose} className={`${BTN_SECONDARY} min-w-32 text-lg`}>Cancel</button>
        <SaveButton />
      </div>
    </form>
  );
}

/** Tab / Shift+Tab wrap around inside the popup instead of leaving it for the browser toolbar. */
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

export function NewEnquiryButton({ label = '+ New Client Enquiry', className = BTN_PRIMARY }: { label?: string; className?: string }): React.JSX.Element {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);

  function show(): void {
    setRound((n) => n + 1); // a fresh, empty form every time
    setOpen(true);
    dialog.current?.showModal();
  }
  function close(): void {
    dialog.current?.close();
  }

  // Keep the page behind the popup from scrolling while it is open.
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(null), 8000);
    return () => window.clearTimeout(t);
  }, [saved]);

  return (
    <>
      <button type="button" onClick={show} className={className} aria-haspopup="dialog">
        {label}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="new-enquiry-title"
        onClose={() => setOpen(false)}
        onKeyDown={keepFocusInside}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto max-h-[94vh] w-[min(94vw,52rem)] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-slate-900/55 open:flex open:flex-col"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5 sm:px-8">
          <div>
            <h2 id="new-enquiry-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">New Client Enquiry</h2>
            <p className="mt-1 text-base text-text-secondary">Save the client&apos;s details. Only the company and the scope of work are required.</p>
          </div>
          <button
            type="button" onClick={close} aria-label="Close"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        {open && (
          <QuickForm
            key={round}
            onClose={close}
            onSaved={(id) => {
              setSaved(id);
              close();
              // Refresh only after the save action has fully settled: a refresh issued while the action is
              // still finishing is dropped by Next, which left the page behind the popup showing old figures.
              window.setTimeout(() => router.refresh(), 250);
            }}
          />
        )}
      </dialog>

      {saved && (
        <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-5 py-4 text-lg font-semibold text-green-900 shadow-lg">
          <CheckCircle2 className="size-6 shrink-0 text-green-700" aria-hidden="true" />
          <span className="flex-1">Enquiry saved successfully.</span>
          <Link href={`/sales/enquiries/${saved}`} className="rounded-md px-2 py-1 text-base font-bold text-green-900 underline hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-focus">
            View enquiry
          </Link>
          <button type="button" onClick={() => setSaved(null)} aria-label="Dismiss" className="rounded-md p-1 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
