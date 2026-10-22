import Link from 'next/link';
import type { FollowUpBucket, SalesStatus } from '@/lib/sales-api';
import { BUCKET_BADGE, BUCKET_LABELS, STATUS_BADGE, STATUS_LABELS } from '../_lib/sales-format';

// Shared building blocks for the Sales screens. No hooks, so usable from server and client components.

export const INPUT_CLASS =
  'w-full rounded-lg border border-border-strong bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus';
export const BTN_PRIMARY =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
export const BTN_SECONDARY =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-5 py-3 text-base font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export function StatusBadge({ status }: { status: SalesStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_BADGE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function BucketBadge({ bucket }: { bucket: FollowUpBucket }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold ${BUCKET_BADGE[bucket]}`}>
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
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold text-text-primary">
        {label}
        {required && <span className="ml-1 text-error" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !errors?.length && <p id={`${id}-hint`} className="mt-1.5 text-sm text-text-secondary">{hint}</p>}
      {errors?.length ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-error">{errors[0]}</p>
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
      {action && <Link href={action.href} className={`${BTN_PRIMARY} mt-5`}>{action.label}</Link>}
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
