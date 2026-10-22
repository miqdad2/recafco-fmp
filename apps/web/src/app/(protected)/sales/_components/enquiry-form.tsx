'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Building2, ClipboardList, CalendarClock, ChevronDown } from 'lucide-react';
import type { SalesFormState } from '../_lib/form-state';
import { BTN_PRIMARY, BTN_SECONDARY, Field, FormMessage, INPUT_CLASS } from './sales-ui';

/**
 * FMP-SALES-01 — the New Client Enquiry / Edit Enquiry form. One page, three plain sections, no wizard.
 * Only the company and the scope are required. The enquiry date, status and "created by" are filled in
 * by the server and are never asked for. Fields are uncontrolled and refilled from `state.values` after a
 * validation error, so nothing the manager typed is lost.
 */
export type EnquiryFormValues = Partial<Record<
  | 'companyName' | 'contactPerson' | 'contactNumber' | 'email' | 'projectName' | 'scopeOfWork' | 'estimatedValue' | 'typeOfWork'
  | 'projectLocation' | 'nextFollowUpDate' | 'remarks' | 'source' | 'estimatedValueSource' | 'expectedStartDate' | 'expectedAwardDate' | 'additionalNotes',
  string
>>;

interface Props {
  mode: 'create' | 'edit';
  action: (prev: SalesFormState, formData: FormData) => Promise<SalesFormState>;
  initial: EnquiryFormValues;
  cancelHref: string;
}

function SubmitButton({ label }: { label: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={BTN_PRIMARY}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children }: { icon: typeof Building2; title: string; subtitle: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function EnquiryForm({ mode, action, initial, cancelHref }: Props): React.JSX.Element {
  const [state, formAction] = useActionState<SalesFormState, FormData>(action, { error: null, fieldErrors: {}, values: {}, ok: null });
  const val = (k: keyof EnquiryFormValues): string => state.values[k] ?? initial[k] ?? '';
  const err = (k: string): string[] | undefined => state.fieldErrors[k];
  const describe = (k: string, hint?: boolean): string | undefined => (err(k)?.length ? `${k}-error` : hint ? `${k}-hint` : undefined);
  const extraOpen = ['source', 'estimatedValueSource', 'expectedStartDate', 'expectedAwardDate', 'additionalNotes'].some((k) => val(k as keyof EnquiryFormValues) || err(k));
  // Re-mount the form when a new result arrives, so the refilled values replace what the browser reset.
  const formKey = JSON.stringify(state.fieldErrors) + (state.error ?? '');

  return (
    <form key={formKey} action={formAction} noValidate className="space-y-6">
      <FormMessage error={state.error} />

      <SectionCard icon={Building2} title="Client Details" subtitle="Who visited or called?">
        <div className="sm:col-span-2">
          <Field id="companyName" label="Company / Client Name" required errors={err('companyName')}>
            <input id="companyName" name="companyName" type="text" defaultValue={val('companyName')} maxLength={200} autoComplete="off"
              aria-required="true" aria-invalid={!!err('companyName')} aria-describedby={describe('companyName')} className={INPUT_CLASS} />
          </Field>
        </div>
        <Field id="contactPerson" label="Contact Person" errors={err('contactPerson')}>
          <input id="contactPerson" name="contactPerson" type="text" defaultValue={val('contactPerson')} maxLength={200} autoComplete="off" className={INPUT_CLASS} />
        </Field>
        <Field id="contactNumber" label="Contact Number" hint="A phone number helps with follow-ups." errors={err('contactNumber')}>
          <input id="contactNumber" name="contactNumber" type="tel" inputMode="tel" defaultValue={val('contactNumber')} maxLength={50} autoComplete="off"
            aria-describedby={describe('contactNumber', true)} className={INPUT_CLASS} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="email" label="Email (optional)" errors={err('email')}>
            <input id="email" name="email" type="email" defaultValue={val('email')} maxLength={254} autoComplete="off"
              aria-invalid={!!err('email')} aria-describedby={describe('email')} className={INPUT_CLASS} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={ClipboardList} title="Project Requirements" subtitle="What does the client need?">
        <div className="sm:col-span-2">
          <Field id="scopeOfWork" label="Scope of Work" required errors={err('scopeOfWork')}>
            <textarea id="scopeOfWork" name="scopeOfWork" rows={6} defaultValue={val('scopeOfWork')} maxLength={10000}
              placeholder="Describe what the client needs, the type of work, quantities, and any important requirements."
              aria-required="true" aria-invalid={!!err('scopeOfWork')} aria-describedby={describe('scopeOfWork')} className={`${INPUT_CLASS} min-h-40 resize-y`} />
          </Field>
        </div>
        <Field id="projectName" label="Project Name" errors={err('projectName')}>
          <input id="projectName" name="projectName" type="text" defaultValue={val('projectName')} maxLength={300} autoComplete="off" className={INPUT_CLASS} />
        </Field>
        <Field id="projectLocation" label="Project Location" errors={err('projectLocation')}>
          <input id="projectLocation" name="projectLocation" type="text" defaultValue={val('projectLocation')} maxLength={300} autoComplete="off" className={INPUT_CLASS} />
        </Field>
        <Field id="typeOfWork" label="Type of Work" errors={err('typeOfWork')}>
          <input id="typeOfWork" name="typeOfWork" type="text" defaultValue={val('typeOfWork')} maxLength={100} autoComplete="off"
            placeholder="For example: steel structure, canopy, warehouse" className={INPUT_CLASS} />
        </Field>
        <Field id="estimatedValue" label="Estimated Project Value (KWD)" hint="Leave blank if the project value is not known yet." errors={err('estimatedValue')}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base font-semibold text-text-secondary" aria-hidden="true">KWD</span>
            <input id="estimatedValue" name="estimatedValue" type="text" inputMode="decimal" defaultValue={val('estimatedValue')} autoComplete="off"
              placeholder="0.000" aria-invalid={!!err('estimatedValue')} aria-describedby={describe('estimatedValue', true)} className={`${INPUT_CLASS} pl-16`} />
          </div>
        </Field>
      </SectionCard>

      <SectionCard icon={CalendarClock} title="Next Action" subtitle="When should we get back to the client?">
        <Field id="nextFollowUpDate" label="Next Follow-up Date" errors={err('nextFollowUpDate')}>
          <input id="nextFollowUpDate" name="nextFollowUpDate" type="date" defaultValue={val('nextFollowUpDate')} className={INPUT_CLASS} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="remarks" label="Remarks" errors={err('remarks')}>
            <textarea id="remarks" name="remarks" rows={3} defaultValue={val('remarks')} maxLength={5000} className={`${INPUT_CLASS} resize-y`} />
          </Field>
        </div>
      </SectionCard>

      <details open={extraOpen} className="group rounded-xl border border-border bg-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 text-lg font-bold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-6">
          <span>More details <span className="text-sm font-normal text-text-secondary">(optional)</span></span>
          <ChevronDown className="size-5 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-5 border-t border-border p-5 sm:grid-cols-2 sm:p-6">
          <Field id="source" label="Enquiry Source" hint="For example: walk-in, phone call, referral." errors={err('source')}>
            <input id="source" name="source" type="text" defaultValue={val('source')} maxLength={100} autoComplete="off" aria-describedby={describe('source', true)} className={INPUT_CLASS} />
          </Field>
          <Field id="estimatedValueSource" label="Where does the estimated value come from?" errors={err('estimatedValueSource')}>
            <input id="estimatedValueSource" name="estimatedValueSource" type="text" defaultValue={val('estimatedValueSource')} maxLength={200} autoComplete="off" className={INPUT_CLASS} />
          </Field>
          <Field id="expectedStartDate" label="Expected Project Start Date" errors={err('expectedStartDate')}>
            <input id="expectedStartDate" name="expectedStartDate" type="date" defaultValue={val('expectedStartDate')} className={INPUT_CLASS} />
          </Field>
          <Field id="expectedAwardDate" label="Expected Confirmation Date" errors={err('expectedAwardDate')}>
            <input id="expectedAwardDate" name="expectedAwardDate" type="date" defaultValue={val('expectedAwardDate')} className={INPUT_CLASS} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="additionalNotes" label="Additional Notes" errors={err('additionalNotes')}>
              <textarea id="additionalNotes" name="additionalNotes" rows={3} defaultValue={val('additionalNotes')} maxLength={5000} className={`${INPUT_CLASS} resize-y`} />
            </Field>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={mode === 'create' ? 'Save Enquiry' : 'Save Changes'} />
        <Link href={cancelHref} className={BTN_SECONDARY}>Cancel</Link>
      </div>
    </form>
  );
}
