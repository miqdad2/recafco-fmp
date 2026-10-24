import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarClock, FolderOpen, FilePlus2, Banknote, Trophy, Percent, ArrowRight, AlertTriangle, Clock, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import type { SalesFollowUpListItem } from '@/lib/sales-api';
import { getCurrentUserContext } from '../contracts/_lib/get-user-permissions';
import { dueText, formatDate, formatKwd, formatMonth, formatRate } from './_lib/sales-format';
import { BTN_SECONDARY, BucketBadge, ContactLine, Section } from './_components/sales-ui';
import { RecentEnquiries } from './_components/recent-enquiries';
import { FollowUpActions } from './_components/follow-up-actions';
import { NewEnquiryButton } from './_components/new-enquiry-modal';

export const metadata: Metadata = { title: 'Sales & Enquiries — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface Kpi {
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  /** Tailwind classes for the card tint / icon chip. */
  tone: string;
  chip: string;
  /** Only set where an existing list shows exactly the records the figure counts. */
  href?: string | undefined;
  hrefLabel?: string | undefined;
}

const NEW_BUTTON =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3 text-xl font-bold text-white shadow-md transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';

function FollowUpRow({ f, today, canUpdate, actions }: { f: SalesFollowUpListItem; today: string; canUpdate: boolean; actions: boolean }): React.JSX.Element {
  const overdue = f.bucket === 'OVERDUE';
  return (
    <li className={`rounded-xl border border-l-8 bg-surface p-5 ${overdue ? 'border-red-200 border-l-red-600 bg-red-50/40' : f.bucket === 'TODAY' ? 'border-amber-200 border-l-amber-500 bg-amber-50/40' : 'border-blue-200 border-l-blue-500'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 break-words text-2xl font-bold leading-snug text-text-primary">{f.enquiry.companyName}</p>
        <div className="flex items-center gap-2">
          {overdue && <AlertTriangle className="size-6 text-red-700" aria-hidden="true" />}
          <BucketBadge bucket={f.bucket} />
        </div>
      </div>
      {f.enquiry.scopeOfWork && <p className="mt-1 line-clamp-2 break-words text-lg text-text-primary">{f.enquiry.scopeOfWork}</p>}
      <div className="mt-2"><ContactLine person={f.enquiry.contactPerson} number={f.enquiry.contactNumber} /></div>
      <p className="mt-2 text-lg text-text-primary">
        <span className="font-semibold">Follow-up date:</span> {formatDate(f.followUpDate)}
        <span className={`ml-2 font-semibold ${overdue ? 'text-red-700' : f.bucket === 'TODAY' ? 'text-amber-800' : 'text-text-secondary'}`}>({dueText(f.bucket, f.followUpDate, today)})</span>
      </p>
      {f.notes && <p className="mt-1 line-clamp-2 break-words text-base text-text-secondary">Note: {f.notes}</p>}
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <Link href={`/sales/enquiries/${f.enquiry.id}`} className={BTN_SECONDARY}>Open Enquiry</Link>
        {actions && canUpdate && <FollowUpActions followUpId={f.id} enquiryId={f.enquiry.id} today={today} compact completeLabel="Record Follow-up" allowReschedule={false} />}
      </div>
    </li>
  );
}

/**
 * FMP-SALES-02 — the Sales dashboard for a senior manager who records enquiries personally: four plain figures,
 * today's follow-ups (overdue first), the latest enquiries beside their status filter, and a small monthly results
 * strip. Metric definitions are unchanged; only presentation, wording and which records are shown are new.
 */
export default async function SalesDashboardPage(): Promise<React.JSX.Element> {
  const [{ permissions }, res] = await Promise.all([getCurrentUserContext(), salesApi.dashboard()]);

  if (res.error) {
    return (
      <div role="alert" className="rounded-xl border border-error bg-error-light px-5 py-4 text-lg text-error">
        The Sales dashboard could not be loaded. Please refresh the page.
      </div>
    );
  }
  const d = res.data;
  const canCreate = permissions.includes('sales.create');
  const canUpdate = permissions.includes('sales.update');
  const monthName = formatMonth(d.month);
  const estimated = formatKwd(d.potentialValue);
  const due = d.followUpsNeedingAttention;
  // Changes whenever anything shown here changes, so the client-side Recent Enquiries list reloads itself.
  const signature = JSON.stringify([d.recentEnquiries.map((e) => [e.id, e.status, e.nextFollowUpDate, e.updatedAt]), d.openEnquiries, d.followUpsDue, d.enquiriesThisMonth]);

  const kpis: Kpi[] = [
    {
      label: 'Active Enquiries',
      value: String(d.openEnquiries),
      caption: 'Enquiries still in progress.',
      icon: FolderOpen,
      tone: 'border-blue-200 bg-blue-50/60',
      chip: 'bg-blue-100 text-blue-800',
      href: '/sales/enquiries?status=open',
      hrefLabel: 'View Active Enquiries',
    },
    {
      label: 'Follow-ups Due',
      value: String(d.followUpsDue),
      caption: d.followUpsDue === 0 ? 'None overdue or due today' : `${d.followUpsOverdue} overdue · ${d.followUpsDueToday} due today`,
      icon: CalendarClock,
      tone: d.followUpsOverdue > 0 ? 'border-red-300 bg-red-50/60' : 'border-amber-300 bg-amber-50/60',
      chip: d.followUpsOverdue > 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900',
      href: '/sales/follow-ups',
      hrefLabel: 'View Follow-ups',
    },
    {
      label: 'New Enquiries This Month',
      value: String(d.enquiriesThisMonth),
      caption: `Received in ${monthName}`,
      icon: FilePlus2,
      tone: 'border-sky-200 bg-sky-50/60',
      chip: 'bg-sky-100 text-sky-800',
      href: `/sales/enquiries?month=${d.month}`,
      hrefLabel: 'View This Month’s Enquiries',
    },
    {
      label: 'Estimated Value of Active Enquiries — KWD',
      value: estimated ? estimated.replace(/^KWD\s/, '') : '—',
      caption: d.openWithoutEstimate > 0
        ? `${d.openWithoutEstimate} active ${d.openWithoutEstimate === 1 ? 'enquiry has' : 'enquiries have'} no estimate and ${d.openWithoutEstimate === 1 ? 'is' : 'are'} not counted`
        : estimated ? 'Active enquiries only' : 'No estimates entered yet',
      icon: Banknote,
      tone: 'border-purple-200 bg-purple-50/60',
      chip: 'bg-purple-100 text-purple-800',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary">Sales &amp; Enquiries</h1>
          <p className="mt-1 text-xl text-text-secondary">Client meetings, new opportunities and follow-ups.</p>
        </div>
        {canCreate && <NewEnquiryButton className={NEW_BUTTON} />}
      </div>

      <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {kpis.map((k) => {
          const body = (
            <>
              <div className="flex items-center gap-3">
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${k.chip}`}>
                  <k.icon className="size-6" aria-hidden="true" />
                </span>
                <p className="text-lg font-semibold leading-snug text-text-primary">{k.label}</p>
              </div>
              <p className="mt-2 break-words text-4xl font-extrabold tabular-nums leading-tight text-text-primary">{k.value}</p>
              <p className="mt-1 text-base leading-snug text-text-secondary">{k.caption}</p>
              {k.href && (
                <p className="mt-2 inline-flex items-center gap-1 text-base font-semibold text-accent">
                  {k.hrefLabel} <ArrowRight className="size-4" aria-hidden="true" />
                </p>
              )}
            </>
          );
          const cls = `block rounded-xl border px-5 py-4 shadow-sm transition ${k.tone}`;
          return k.href ? (
            <Link key={k.label} href={k.href} className={`${cls} hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`}>{body}</Link>
          ) : (
            <div key={k.label} className={cls}>{body}</div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Today’s Follow-ups"
          aside={<Link href="/sales/follow-ups" className="inline-flex min-h-12 items-center gap-1 text-lg font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">View Follow-ups <ArrowRight className="size-5" aria-hidden="true" /></Link>}
        >
          {due.length > 0 ? (
            <>
              <ul className="space-y-4">
                {due.map((f) => <FollowUpRow key={f.id} f={f} today={d.today} canUpdate={canUpdate} actions />)}
              </ul>
              {d.followUpsDue > due.length && (
                <p className="mt-3 text-base text-text-secondary">Showing {due.length} of {d.followUpsDue}. <Link href="/sales/follow-ups" className="font-semibold text-accent hover:underline">View Follow-ups</Link></p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary/60 px-5 py-4 text-lg font-medium text-text-primary">
                <Clock className="mt-0.5 size-6 shrink-0 text-text-secondary" aria-hidden="true" />
                No follow-ups are overdue or due today.
              </p>
              {d.upcomingFollowUps.length > 0 && (
                <div>
                  <h3 className="mb-3 text-xl font-bold text-text-primary">Next upcoming follow-ups</h3>
                  <ul className="space-y-4">
                    {d.upcomingFollowUps.map((f) => <FollowUpRow key={f.id} f={f} today={d.today} canUpdate={canUpdate} actions={false} />)}
                  </ul>
                  {d.upcomingFollowUpCount > d.upcomingFollowUps.length && (
                    <p className="mt-3 text-base text-text-secondary">Showing {d.upcomingFollowUps.length} of {d.upcomingFollowUpCount} scheduled. <Link href="/sales/follow-ups" className="font-semibold text-accent hover:underline">View Follow-ups</Link></p>
                  )}
                </div>
              )}
            </div>
          )}
          {d.activeWithoutFollowUp > 0 && (
            <p className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-lg text-amber-950">
              <Info className="mt-0.5 size-6 shrink-0 text-amber-800" aria-hidden="true" />
              <span>
                <span className="font-semibold">{d.activeWithoutFollowUp} active {d.activeWithoutFollowUp === 1 ? 'enquiry has' : 'enquiries have'} no next follow-up date.</span>{' '}
                <Link href="/sales/enquiries?status=open" className="font-semibold underline">Review active enquiries</Link>
              </span>
            </p>
          )}
        </Section>

        <Section title="Recent Enquiries">
          <RecentEnquiries
            initial={d.recentEnquiries}
            initialTotal={Object.values(d.statusCounts).reduce((n, c) => n + c, 0)}
            signature={signature}
            canCreate={canCreate}
            canUpdate={canUpdate}
            today={d.today}
            newButtonClass={NEW_BUTTON}
          />
        </Section>
      </div>

      <section aria-labelledby="monthly-results" className="rounded-xl border border-green-200 bg-green-50/40 p-4 sm:p-5">
        <h2 id="monthly-results" className="text-xl font-bold text-text-primary">Monthly Results <span className="font-medium text-text-secondary">— {monthName}</span></h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-lg border border-green-300 bg-surface px-4 py-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-800"><Trophy className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="text-lg font-semibold text-text-primary">Confirmed Projects</p>
              <p className="text-3xl font-extrabold tabular-nums text-text-primary">{d.projectsWon}</p>
              <p className="text-base text-text-secondary">Confirmed in {monthName}</p>
            </div>
          </div>
          {d.conversion && (
            <div className="flex items-center gap-4 rounded-lg border border-green-300 bg-surface px-4 py-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-800"><Percent className="size-6" aria-hidden="true" /></span>
              <div>
                <p className="text-lg font-semibold text-text-primary">Conversion This Month</p>
                <p className="text-3xl font-extrabold tabular-nums text-text-primary">{formatRate(d.conversion.rate)}</p>
                <p className="text-base text-text-secondary">
                  {d.conversion.rate === null ? `No enquiries in ${monthName} yet` : `${d.conversion.won} of ${d.conversion.created} enquiries from ${monthName} confirmed`}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
