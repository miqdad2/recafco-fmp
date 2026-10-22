import Link from 'next/link';
import type { Metadata } from 'next';
import { Phone } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import type { FollowUpBucket, SalesFollowUpListItem } from '@/lib/sales-api';
import { getCurrentUserContext } from '../../contracts/_lib/get-user-permissions';
import { BUCKET_LABELS, dueText, formatDate } from '../_lib/sales-format';
import { BucketBadge, EmptyState } from '../_components/sales-ui';
import { FollowUpActions } from '../_components/follow-up-actions';

export const metadata: Metadata = { title: 'Follow-ups — Sales & Enquiries — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type Group = Exclude<FollowUpBucket, 'CANCELLED'>;
const GROUPS: { key: Group; tone: string; empty: string }[] = [
  { key: 'OVERDUE', tone: 'border-red-300 bg-red-50/50', empty: 'Nothing is overdue.' },
  { key: 'TODAY', tone: 'border-amber-300 bg-amber-50/50', empty: 'Nothing is due today.' },
  { key: 'UPCOMING', tone: 'border-blue-200 bg-blue-50/40', empty: 'No upcoming follow-ups are scheduled.' },
  { key: 'COMPLETED', tone: 'border-green-300 bg-green-50/40', empty: 'No follow-ups have been completed yet.' },
];

function Item({ f, today, canUpdate }: { f: SalesFollowUpListItem; today: string; canUpdate: boolean }): React.JSX.Element {
  return (
    <li className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/sales/enquiries/${f.enquiry.id}`} className="break-words text-lg font-bold text-text-primary hover:text-accent hover:underline">{f.enquiry.companyName}</Link>
          <p className="text-sm text-text-secondary">
            {f.enquiry.enquiryNumber}
            {f.enquiry.contactPerson ? ` · ${f.enquiry.contactPerson}` : ''}
          </p>
          {f.enquiry.contactNumber && (
            <a href={`tel:${f.enquiry.contactNumber}`} className="mt-0.5 inline-flex items-center gap-1.5 text-base font-medium text-blue-700 hover:underline">
              <Phone className="size-4" aria-hidden="true" /> {f.enquiry.contactNumber}
            </a>
          )}
        </div>
        <div className="text-right">
          <BucketBadge bucket={f.bucket} />
          <p className="mt-1 text-sm font-semibold text-text-primary">{formatDate(f.followUpDate)}</p>
          {f.bucket !== 'COMPLETED' && <p className="text-xs text-text-secondary">{dueText(f.bucket, f.followUpDate, today)}</p>}
        </div>
      </div>
      {f.notes && <p className="mt-2 text-base text-text-primary">{f.notes}</p>}
      <p className="mt-1 text-sm text-text-secondary">
        {f.bucket === 'COMPLETED'
          ? `Completed ${f.completedAt ? formatDate(f.completedAt.slice(0, 10)) : ''}${f.completedBy ? ` by ${f.completedBy.displayName}` : ''}${f.completionNotes ? ` — ${f.completionNotes}` : ''}`
          : f.responsibleUser ? `Responsible: ${f.responsibleUser.displayName}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <Link href={`/sales/enquiries/${f.enquiry.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-border-strong px-4 text-sm font-semibold hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
          Open Enquiry
        </Link>
        {canUpdate && f.bucket !== 'COMPLETED' && <FollowUpActions followUpId={f.id} enquiryId={f.enquiry.id} today={today} compact />}
      </div>
    </li>
  );
}

export default async function FollowUpsPage(): Promise<React.JSX.Element> {
  const [{ permissions }, res] = await Promise.all([getCurrentUserContext(), salesApi.followUps()]);
  if (res.error) {
    return <div role="alert" className="rounded-xl border border-error bg-error-light px-5 py-4 text-base text-error">The follow-ups could not be loaded. Please refresh the page.</div>;
  }
  const { items, counts, today } = res.data;
  const canUpdate = permissions.includes('sales.update');
  const nothing = items.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Follow-ups</h1>
        <p className="mt-1 text-lg text-text-secondary">Who to call back, and when. Completed follow-ups stay on record.</p>
      </div>

      {nothing && <EmptyState title="No follow-ups yet" text="When you save an enquiry with a next follow-up date, it appears here." />}

      {GROUPS.map((g) => {
        const list = items.filter((f) => f.bucket === g.key);
        if (nothing) return null;
        return (
          <section key={g.key} aria-labelledby={`g-${g.key}`} className={`rounded-xl border p-4 sm:p-5 ${g.tone}`}>
            <h2 id={`g-${g.key}`} className="mb-3 flex items-center gap-3 text-xl font-bold text-text-primary">
              {BUCKET_LABELS[g.key]}
              <span className="rounded-full bg-surface px-3 py-0.5 text-base font-bold tabular-nums">{counts[g.key]}</span>
            </h2>
            {list.length === 0 ? (
              <p className="text-base text-text-secondary">{g.empty}</p>
            ) : (
              <ul className="space-y-3">{list.map((f) => <Item key={f.id} f={f} today={today} canUpdate={canUpdate} />)}</ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
