import Link from 'next/link';
import { FolderOpen, Phone } from 'lucide-react';
import type { FollowUpBucket, SalesStatus } from '@/lib/sales-api';
import { BUCKET_BADGE, BUCKET_LABELS, formatDate, STATUS_BADGE, STATUS_FILTER_VALUE, STATUS_LABELS, STATUS_ORDER } from '../_lib/sales-format';

// Shared building blocks for the Sales screens. No hooks, so usable from server and client components.

export const INPUT_CLASS =
  'w-full rounded-lg border border-border-strong bg-surface min-h-12 px-4 py-3 text-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus';
/**
 * FMP-SALES-08 — ONE button system for Sales Activities. Every action has one colour, one label and one icon wherever it
 * appears: Open Enquiry = blue, Add Activity / New Client Enquiry (and saving them) = RECAFCO red, Change Status and
 * Reschedule = amber with dark text, Mark Completed = green, Cancel / Back / everything else neutral with a visible border.
 * All are 48px high, 18px semibold, with a visible edge and shadow before hover, plus hover, pressed, keyboard-focus,
 * saving and disabled states. Text/background pairs all meet 4.5:1 (checked in sales-format.test.ts).
 */
const BTN_BASE =
  'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 text-lg font-semibold leading-tight shadow-sm transition-colors duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus focus-visible:ring-offset-2 active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60';
export const BTN_OPEN = `${BTN_BASE} border-blue-900 bg-blue-700 text-white hover:bg-blue-800 active:bg-blue-900`;
export const BTN_ADD = `${BTN_BASE} border-red-900 bg-accent text-white hover:brightness-90 active:brightness-75`;
export const BTN_STATUS = `${BTN_BASE} border-amber-700 bg-amber-400 text-slate-900 hover:bg-amber-300 active:bg-amber-500`;
export const BTN_DONE = `${BTN_BASE} border-green-900 bg-green-700 text-white hover:bg-green-800 active:bg-green-900`;
export const BTN_NEUTRAL = `${BTN_BASE} border-slate-500 bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200`;
/** Kept names used by the forms: primary = the red create/save button, secondary = the neutral Cancel/Back style. */
export const BTN_PRIMARY = BTN_ADD;
export const BTN_SECONDARY = BTN_NEUTRAL;

/** Open Enquiry — the same blue button with the same folder icon everywhere. */
export function OpenEnquiryLink({ href, companyName, className = '' }: { href: string; companyName?: string; className?: string }): React.JSX.Element {
  return (
    <Link href={href} className={`${BTN_OPEN} ${className}`} {...(companyName ? { 'aria-label': `Open Enquiry: ${companyName}` } : {})}>
      <FolderOpen className="size-5 shrink-0" aria-hidden="true" /> Open Enquiry
    </Link>
  );
}

/** The saved status, shown as information (not a control), with its label. */
export function CurrentStatus({ status }: { status: SalesStatus }): React.JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-text-secondary 2xl:text-lg">
      <span>Current Status:</span> <StatusBadge status={status} />
    </p>
  );
}

export function StatusBadge({ status }: { status: SalesStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-base font-semibold ${STATUS_BADGE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function BucketBadge({ bucket }: { bucket: FollowUpBucket }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-base font-semibold ${BUCKET_BADGE[bucket]}`}>
      {BUCKET_LABELS[bucket]}
    </span>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  errors?: string[] | undefined;
  children: React.ReactNode;
}

/** Label above the control, optional hint, and the error right under it. */
export function Field({ id, label, required, hint, errors, children }: FieldProps): React.JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-lg font-semibold text-text-primary">
        {label}
        {required && <span className="ml-1 text-error" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !errors?.length && <p id={`${id}-hint`} className="mt-1.5 text-base text-text-secondary">{hint}</p>}
      {errors?.length ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-base font-medium text-error">{errors[0]}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({ error, ok }: { error: string | null | undefined; ok?: string | null | undefined }): React.JSX.Element | null {
  if (error) {
    return <div role="alert" className="rounded-lg border border-error bg-error-light px-4 py-3 text-base font-medium text-error">{error}</div>;
  }
  if (ok) {
    return <div role="status" className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-base font-medium text-green-800">{ok}</div>;
  }
  return null;
}

export function EmptyState({ title, text, action, actionNode }: { title: string; text: string; action?: { href: string; label: string } | undefined; actionNode?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <p className="text-2xl font-bold text-text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-lg text-text-secondary">{text}</p>
      {action && <Link href={action.href} className={`${BTN_NEUTRAL} mt-5`}>{action.label}</Link>}
      {actionNode && <div className="mt-5">{actionNode}</div>}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * FMP-SALES-02 — the one status filter for enquiry lists: All, Active, Follow-up Needed and a "More Statuses" selector
 * holding every existing status. "Active" is the existing 'open' filter (every status except Confirmed and Not
 * Proceeding), not a stored status. It always navigates to All Enquiries and carries the search/month already chosen.
 */
const CHIP = 'inline-flex min-h-12 items-center rounded-full border px-5 text-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
const CHIP_ON = 'border-text-primary bg-text-primary text-white';
const CHIP_OFF = 'border-border-strong bg-surface text-text-primary hover:bg-surface-secondary';

export function StatusFilter({ status, search = '', month = '' }: { status: string; search?: string; month?: string }): React.JSX.Element {
  const to = (value: string): string => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (value) qs.set('status', value);
    if (month) qs.set('month', month);
    const q = qs.toString();
    return `/sales/enquiries${q ? `?${q}` : ''}`;
  };
  const chips = [
    { value: '', label: 'All' },
    { value: 'open', label: 'Active' },
    { value: STATUS_FILTER_VALUE.FOLLOW_UP, label: STATUS_LABELS.FOLLOW_UP },
  ];
  const inChips = chips.some((c) => c.value === status);
  return (
    <div>
      <div role="group" aria-label="Filter enquiries by status" className="flex flex-wrap items-center gap-3">
        {chips.map((c) => (
          <Link key={c.label} href={to(c.value)} aria-current={status === c.value ? 'true' : undefined} className={`${CHIP} ${status === c.value ? CHIP_ON : CHIP_OFF}`}>
            {c.label}
          </Link>
        ))}
        <form method="get" action="/sales/enquiries" className="flex items-center gap-2">
          {search && <input type="hidden" name="search" value={search} />}
          {month && <input type="hidden" name="month" value={month} />}
          <label htmlFor="more-statuses" className="sr-only">More statuses</label>
          <select
            id="more-statuses" name="status" defaultValue={inChips ? '' : status}
            className={`min-h-12 rounded-full border px-4 text-lg font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${!inChips ? CHIP_ON : CHIP_OFF}`}
          >
            <option value="">More Statuses…</option>
            {STATUS_ORDER.map((st) => (
              <option key={st} value={STATUS_FILTER_VALUE[st]}>{STATUS_LABELS[st]}</option>
            ))}
          </select>
          <button type="submit" className={`${CHIP} ${CHIP_OFF}`}>Show</button>
        </form>
      </div>
    </div>
  );
}

export function ContactLine({ person, number }: { person: string | null; number: string | null }): React.JSX.Element {
  if (!person && !number) return <p className="dense-hide text-lg text-text-secondary">No contact saved</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-text-primary">
      {person && <span>{person}</span>}
      {number && (
        <a href={`tel:${number}`} className="inline-flex items-center gap-1.5 font-medium text-blue-800 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Phone className="size-5" aria-hidden="true" /> {number}
        </a>
      )}
    </p>
  );
}

/** FMP-SALES-05 — short "Latest Activity" preview for enquiry rows and cards (full text is on the enquiry page). */
export function LatestActivity({ activity, compact = false }: { activity: { activityDate: string; notes: string | null; recordedBy: string } | null; compact?: boolean }): React.JSX.Element {
  if (!activity) return <p className="mt-1 text-base text-text-secondary">No activity yet</p>;
  return (
    <p className="mt-1 text-base text-text-primary">
      <span className="font-semibold">Latest activity · {formatDate(activity.activityDate)}:</span>{' '}
      <span className={`${compact ? 'line-clamp-1' : 'line-clamp-2'} break-words`}>{activity.notes}</span>
    </p>
  );
}
