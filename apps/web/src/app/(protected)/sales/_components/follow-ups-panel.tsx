'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ArrowRight, Clock, Info } from 'lucide-react';
import type { SalesFollowUpListItem } from '@/lib/sales-api';
import { useFittedCount } from '../_lib/use-fitted-count';
import { TASK_NOT_RECORDED, dueText, formatDate, taskText } from '../_lib/sales-format';
import { BucketBadge, ContactLine, OpenEnquiryLink } from './sales-ui';
import { FollowUpActions } from './follow-up-actions';

function FollowUpCard({ f, today, canUpdate, actions }: { f: SalesFollowUpListItem; today: string; canUpdate: boolean; actions: boolean }): React.JSX.Element {
  const overdue = f.bucket === 'OVERDUE';
  const task = taskText(f.notes);
  const tone = overdue ? 'border-red-200 border-l-red-600 bg-red-50/40' : f.bucket === 'TODAY' ? 'border-amber-200 border-l-amber-500 bg-amber-50/40' : 'border-blue-200 border-l-blue-500';
  return (
    <li className={`sd-fu-card rounded-xl border border-l-8 bg-surface p-3 2xl:p-4 ${tone}`}>
      <p title={task ?? undefined} className={`sd-short-clamp line-clamp-2 min-w-0 break-words text-xl font-bold leading-snug 2xl:text-2xl min-[137.5rem]:text-3xl ${task ? 'text-text-primary' : 'italic text-text-secondary'}`}>{task ?? TASK_NOT_RECORDED}</p>
      <p title={f.enquiry.companyName} className="sd-short-clamp dense-clamp-1 line-clamp-2 min-w-0 break-words text-lg font-semibold text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">{f.enquiry.companyName} <span className="font-normal text-text-secondary">· {f.enquiry.enquiryNumber}</span></p>
      <div className="sd-short-hide dense-hide"><ContactLine person={f.enquiry.contactPerson} number={f.enquiry.contactNumber} /></div>
      <p className="sd-fu-due mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">
        <BucketBadge bucket={f.bucket} />
        <span><span className="sd-repeats font-semibold">Follow-up date:</span> {formatDate(f.followUpDate)}</span>
        <span className={`dense-hide font-semibold ${overdue ? 'text-red-700' : f.bucket === 'TODAY' ? 'text-amber-800' : 'text-text-secondary'}`}>({dueText(f.bucket, f.followUpDate, today)})</span>
      </p>
      <div className="sd-btn-row mt-2 flex flex-wrap items-start gap-2">
        <OpenEnquiryLink href={`/sales/enquiries/${f.enquiry.id}`} companyName={f.enquiry.companyName} />
        {actions && canUpdate && <FollowUpActions followUpId={f.id} enquiryId={f.enquiry.id} today={today} compact allowReschedule={false} />}
      </div>
    </li>
  );
}

interface Props {
  due: SalesFollowUpListItem[];
  dueTotal: number;
  upcoming: SalesFollowUpListItem[];
  upcomingTotal: number;
  activeWithoutFollowUp: number;
  today: string;
  canUpdate: boolean;
}

/**
 * FMP-SALES-07 — Today's Follow-ups. Shows only the complete cards that fit the window (see useFittedCount) and says
 * plainly how many of the total are shown; View Follow-ups opens the full list.
 */
export function FollowUpsPanel({ due, dueTotal, upcoming, upcomingTotal, activeWithoutFollowUp, today, canUpdate }: Props): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  const showingDue = due.length > 0;
  const items = showingDue ? due : upcoming;
  const total = showingDue ? dueTotal : upcomingTotal;
  const shown = useFittedCount(listRef, items.map((f) => f.id).join(','));
  const count = Math.min(shown, items.length);

  return (
    <section aria-labelledby="todays-follow-ups" className="sd-panel sd-fu rounded-xl border border-border bg-surface p-3 shadow-sm 2xl:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="todays-follow-ups" className="flex flex-wrap items-baseline gap-x-3 text-xl font-bold text-text-primary 2xl:text-2xl min-[137.5rem]:text-3xl">
          Today’s Follow-ups
        </h2>
        <Link href="/sales/follow-ups" className="sd-short-none inline-flex min-h-9 items-center gap-1 text-lg font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus 2xl:text-xl min-[137.5rem]:text-2xl">
          View Follow-ups <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
        {activeWithoutFollowUp > 0 && (
          // Short desktop windows: the "no follow-up date" reminder moves up into the heading row as one short link.
          <Link href="/sales/enquiries?status=open" className="sd-short-only rounded-md font-semibold text-amber-900 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label={`${activeWithoutFollowUp} active ${activeWithoutFollowUp === 1 ? 'enquiry has' : 'enquiries have'} no next follow-up date. Review active enquiries`}>
            {activeWithoutFollowUp} without follow-up
          </Link>
        )}
      </div>

      {!showingDue && (
        <p className="sd-none-due mb-2 flex items-start gap-3 rounded-lg border border-border bg-surface-secondary/60 px-4 py-2 text-lg font-medium text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">
          <Clock className="mt-0.5 size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <span className="sd-short-hide">No follow-ups are overdue or due today.</span>
          <span className="sd-short-only">Nothing overdue or due today</span>
        </p>
      )}
      {!showingDue && upcoming.length > 0 && <h3 className="sd-short-hide mb-2 text-lg font-bold text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">Next upcoming follow-ups</h3>}
      {items.length > 0 && (
        <ul ref={listRef} className="space-y-3">
          {items.map((f) => <FollowUpCard key={f.id} f={f} today={today} canUpdate={canUpdate} actions={showingDue} />)}
        </ul>
      )}
      {items.length > 0 && (
        <p className="mt-2 text-base text-text-secondary 2xl:text-lg min-[137.5rem]:text-xl" data-showing={`${count}/${total}`}>
          <span className="font-semibold text-text-primary">Showing {count} of {total}</span> {showingDue ? 'due' : 'upcoming'}
          {' · '}<Link href="/sales/follow-ups" className="font-semibold text-accent underline-offset-2 hover:underline">View Follow-ups</Link>
        </p>
      )}
      {activeWithoutFollowUp > 0 && (
        <p className="sd-short-hide sd-note mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-base text-amber-950 2xl:text-lg min-[137.5rem]:text-xl">
          <Info className="mt-0.5 size-5 shrink-0 text-amber-800" aria-hidden="true" />
          <span>
            <span className="sd-short-hide font-semibold">{activeWithoutFollowUp} active {activeWithoutFollowUp === 1 ? 'enquiry has' : 'enquiries have'} no next follow-up date. </span>
            <span className="sd-short-only font-semibold">{activeWithoutFollowUp} active without a follow-up · </span>
            <Link href="/sales/enquiries?status=open" className="font-semibold underline"><span className="sd-short-hide">Review active enquiries</span><span className="sd-short-only">Review</span></Link>
          </span>
        </p>
      )}
    </section>
  );
}
