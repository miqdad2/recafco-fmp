import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Phone, UserRound } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import type { FollowUpFilter, SalesFollowUpListItem } from '@/lib/sales-api';
import { getCurrentUserContext } from '../../contracts/_lib/get-user-permissions';
import { TASK_NOT_RECORDED, dueText, formatDate, taskText } from '../_lib/sales-format';
import { BTN_NEUTRAL, BucketBadge, CHIP, CHIP_OFF, CHIP_ON, EmptyState, OpenEnquiryLink } from '../_components/sales-ui';
import { FollowUpActions } from '../_components/follow-up-actions';

export const metadata: Metadata = { title: 'Follow-ups — Sales Activities — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

const FILTERS: { key: FollowUpFilter; label: string; empty: string }[] = [
  { key: 'PENDING', label: 'Pending', empty: 'No follow-up tasks are waiting. Tasks you schedule in “Add Activity” appear here.' },
  { key: 'OVERDUE', label: 'Overdue', empty: 'Nothing is overdue.' },
  { key: 'TODAY', label: 'Due Today', empty: 'Nothing is due today.' },
  { key: 'UPCOMING', label: 'Upcoming', empty: 'No upcoming follow-up tasks are scheduled.' },
  { key: 'COMPLETED', label: 'Completed', empty: 'No follow-up tasks have been completed yet.' },
];
const KEYS = FILTERS.map((f) => f.key);

function href(bucket: FollowUpFilter, page = 1): string {
  const qs = new URLSearchParams();
  if (bucket !== 'PENDING') qs.set('bucket', bucket);
  if (page > 1) qs.set('page', String(page));
  const s = qs.toString();
  return `/sales/follow-ups${s ? `?${s}` : ''}`;
}

/** One card = one follow-up task. The task is the heading; the enquiry it belongs to is identified underneath. */
function TaskCard({ f, today, canUpdate }: { f: SalesFollowUpListItem; today: string; canUpdate: boolean }): React.JSX.Element {
  const task = taskText(f.notes);
  const done = f.bucket === 'COMPLETED';
  const tone = f.bucket === 'OVERDUE' ? 'border-l-red-600' : f.bucket === 'TODAY' ? 'border-l-amber-500' : done ? 'border-l-green-600' : 'border-l-blue-500';
  return (
    <li data-follow-up-id={f.id} className={`rounded-xl border border-l-8 border-border bg-surface p-5 shadow-sm ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className={`min-w-0 flex-1 break-words text-2xl font-bold leading-snug ${task ? 'text-text-primary' : 'italic text-text-secondary'}`}>{task ?? TASK_NOT_RECORDED}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
          <BucketBadge bucket={f.bucket} />
          <span className="text-lg font-semibold text-text-primary">{formatDate(f.followUpDate)}</span>
          {!done && <span className={`text-lg ${f.bucket === 'OVERDUE' ? 'font-semibold text-red-700' : 'text-text-secondary'}`}>{dueText(f.bucket, f.followUpDate, today)}</span>}
        </div>
      </div>

      <p className="mt-2 text-xl font-semibold text-text-primary">
        {f.enquiry.companyName} <span className="font-normal text-text-secondary">· {f.enquiry.enquiryNumber}</span>
      </p>
      {(f.enquiry.contactPerson || f.enquiry.contactNumber) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-text-primary">
          {f.enquiry.contactPerson && <span className="inline-flex items-center gap-1.5"><UserRound className="size-5 text-text-secondary" aria-hidden="true" /> {f.enquiry.contactPerson}</span>}
          {f.enquiry.contactNumber && (
            <a href={`tel:${f.enquiry.contactNumber}`} className="inline-flex items-center gap-1.5 font-medium text-blue-800 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Phone className="size-5" aria-hidden="true" /> {f.enquiry.contactNumber}
            </a>
          )}
        </p>
      )}
      {f.responsibleUser && <p className="mt-1 text-lg text-text-secondary">Responsible: <span className="font-medium text-text-primary">{f.responsibleUser.displayName}</span></p>}
      {done && (
        <p className="mt-1 text-lg text-text-secondary">
          Completed {f.completedAt ? formatDate(f.completedAt.slice(0, 10)) : ''}{f.completedBy ? ` by ${f.completedBy.displayName}` : ''}{f.completionNotes ? ` — ${f.completionNotes}` : ''}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-start gap-2">
        <OpenEnquiryLink href={`/sales/enquiries/${f.enquiry.id}`} companyName={f.enquiry.companyName} />
        {canUpdate && !done && <FollowUpActions followUpId={f.id} enquiryId={f.enquiry.id} today={today} />}
      </div>
    </li>
  );
}

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<Params> }): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const requested = one(sp['bucket']) as FollowUpFilter;
  const bucket: FollowUpFilter = KEYS.includes(requested) ? requested : 'PENDING';
  const page = Math.max(1, Number.parseInt(one(sp['page']), 10) || 1);

  const qs = new URLSearchParams({ bucket, page: String(page), pageSize: '15' });
  const [{ permissions }, res] = await Promise.all([getCurrentUserContext(), salesApi.followUps(qs)]);
  if (res.error) {
    return <div role="alert" className="rounded-xl border border-error bg-error-light px-5 py-4 text-base text-error">The follow-ups could not be loaded. Please refresh the page.</div>;
  }
  const { items, counts, today, pagination } = res.data;
  // The last task on a later page was just completed: go back to the first page instead of showing an empty one.
  if (items.length === 0 && page > 1) redirect(href(bucket));
  const canUpdate = permissions.includes('sales.update');
  const active = FILTERS.find((f) => f.key === bucket)!;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Follow-ups</h1>
        <p className="mt-1 text-lg text-text-secondary">Work to do for your clients, earliest first. Completed tasks stay on record.</p>
      </div>

      <nav aria-label="Filter follow-ups" className="flex flex-wrap items-center gap-3">
        {FILTERS.map((f) => (
          <Link key={f.key} href={href(f.key)} aria-current={bucket === f.key ? 'true' : undefined} className={`${CHIP} gap-2 ${bucket === f.key ? CHIP_ON : CHIP_OFF}`}>
            {f.label}
            <span className={`rounded-full px-2.5 py-0.5 text-base font-bold tabular-nums ${bucket === f.key ? 'bg-white/20' : 'bg-surface-secondary'}`}>{counts[f.key]}</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState title={bucket === 'PENDING' ? 'No pending follow-ups' : `No ${active.label.toLowerCase()} follow-ups`} text={active.empty}
          {...(bucket !== 'PENDING' ? { action: { href: '/sales/follow-ups', label: 'Show Pending' } } : {})} />
      ) : (
        <>
          <ul className="space-y-3">{items.map((f) => <TaskCard key={f.id} f={f} today={today} canUpdate={canUpdate} />)}</ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base text-text-secondary">
              {pagination.total} {pagination.total === 1 ? 'task' : 'tasks'} · page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              {pagination.page > 1 && <Link href={href(bucket, pagination.page - 1)} className={BTN_NEUTRAL}>Previous</Link>}
              {pagination.page < pagination.totalPages && <Link href={href(bucket, pagination.page + 1)} className={BTN_NEUTRAL}>Next</Link>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
