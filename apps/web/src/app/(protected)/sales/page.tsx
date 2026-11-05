import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarClock, FolderOpen, FilePlus2, Banknote, Trophy, FileCheck2, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import { getCurrentUserContext } from '../contracts/_lib/get-user-permissions';
import { compactKwd, formatKwd, formatMonth } from './_lib/sales-format';
import { RecentEnquiries } from './_components/recent-enquiries';
import { FollowUpsPanel } from './_components/follow-ups-panel';
import { DashboardClock } from './_components/dashboard-clock';
import { ExactAmount } from './_components/exact-amount';

export const metadata: Metadata = { title: 'Sales Activities — RECAFCO FMP' };
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
  /** Exact amount when the value is shown in words (tooltip / screen readers). */
  exact?: string | undefined;
  /** Shown in words ('million', 'billion') next to the number, in a smaller size. */
  unit?: string | undefined;
  /** A shorter label and caption for short desktop windows (the full ones are used everywhere else). */
  shortLabel?: string | undefined;
  shortCaption?: string | undefined;
  shortWarn?: boolean | undefined;
  /** The caption only repeats what the label already says; on short desktop windows it is kept for screen readers only. */
  repeatsLabel?: boolean;
}

const MONTHLY_LINK =
  'mt-0.5 inline-flex min-h-12 items-center gap-1 self-start rounded-md text-base font-semibold text-blue-800 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus 2xl:text-lg min-[137.5rem]:text-xl';

const NEW_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2 text-xl font-bold text-white shadow-md transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';

/**
 * FMP-SALES-06 — the Sales Activities dashboard. Order: heading and New Client Enquiry, four summary cards, the
 * Monthly Results section (three cards), then Today's Follow-ups beside Recent Enquiries. Metric definitions are unchanged. The reporting
 * month always comes from the server's Kuwait calendar together with the figures (never the browser's), and
 * DashboardClock re-reads the page when the Kuwait date changes while it is open.
 */
export default async function SalesDashboardPage(): Promise<React.JSX.Element> {
  const [{ permissions }, res] = await Promise.all([getCurrentUserContext(), salesApi.dashboard()]);

  if (res.error) {
    return (
      <div role="alert" className="rounded-xl border border-error bg-error-light px-5 py-4 text-lg text-error">
        The Sales Activities dashboard could not be loaded. Please refresh the page.
      </div>
    );
  }
  const d = res.data;
  const canCreate = permissions.includes('sales.create');
  const canUpdate = permissions.includes('sales.update');
  const monthName = formatMonth(d.month);
  const estimated = formatKwd(d.potentialValue);
  const activeValue = compactKwd(d.potentialValue);
  // Only the recorded estimates are summed; when none of this month's confirmed enquiries has one this is null (never shown as 0).
  const confirmedValue = d.confirmedMonth.withEstimate > 0 ? compactKwd(d.confirmedMonth.estimatedValue) : null;
  const due = d.followUpsNeedingAttention;
  // Changes whenever anything shown here changes, so the client-side Recent Enquiries list reloads itself.
  const signature = JSON.stringify([d.month, d.recentEnquiries.map((e) => [e.id, e.status, e.nextFollowUpDate, e.updatedAt, e.latestActivity?.id ?? null]), d.openEnquiries, d.followUpsDue, d.enquiriesThisMonth]);

  const kpis: Kpi[] = [
    {
      label: 'Active Enquiries',
      value: String(d.openEnquiries),
      caption: 'Enquiries still in progress.',
      repeatsLabel: true,
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
      shortCaption: d.followUpsOverdue > 0 ? `${d.followUpsOverdue} overdue` : d.followUpsDueToday > 0 ? `${d.followUpsDueToday} due today` : 'None due',
      shortWarn: d.followUpsOverdue > 0,
    },
    {
      label: 'New Enquiries This Month',
      value: String(d.enquiriesThisMonth),
      caption: `Received in ${monthName}`,
      repeatsLabel: true,
      icon: FilePlus2,
      tone: 'border-sky-200 bg-sky-50/60',
      chip: 'bg-sky-100 text-sky-800',
      href: `/sales/enquiries?month=${d.month}`,
      hrefLabel: 'View This Month’s Enquiries',
    },
    {
      label: 'Estimated Value of Active Enquiries — KWD',
      value: activeValue ? activeValue.number : '—',
      unit: activeValue?.unit || undefined,
      shortLabel: 'Estimated Active Value — KWD',
      exact: activeValue && activeValue.text !== activeValue.exact ? activeValue.exact : undefined,
      shortCaption: d.openWithoutEstimate > 0 ? `${d.openWithoutEstimate} without estimate` : undefined,
      shortWarn: true,
      caption: d.openWithoutEstimate > 0
        ? `${d.openWithoutEstimate} active ${d.openWithoutEstimate === 1 ? 'enquiry has' : 'enquiries have'} no estimate, not counted`
        : estimated ? 'Active enquiries only' : 'No estimates entered yet',
      repeatsLabel: d.openWithoutEstimate === 0 && Boolean(estimated),
      icon: Banknote,
      tone: 'border-purple-200 bg-purple-50/60',
      chip: 'bg-purple-100 text-purple-800',
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-3 2xl:gap-4" data-sales-dashboard-month={d.month}>
      <h1 className="sr-only">Sales Activities dashboard</h1>
      <DashboardClock serverToday={d.today} />
      <section aria-label="Key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-4">
        {kpis.map((k) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-semibold leading-snug text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">{k.shortLabel ? <><span className="sd-short-hide">{k.label}</span><span className="sd-short-only">{k.shortLabel}</span></> : k.label}</p>
                <span className={`hidden size-9 shrink-0 items-center justify-center rounded-lg 2xl:flex ${k.chip}`}>
                  <k.icon className="size-5" aria-hidden="true" />
                </span>
                {k.href && <ArrowRight className="sd-open-arrow mt-1 hidden size-5 shrink-0 text-accent" aria-hidden="true" />}
              </div>
              <div className="sd-kpi-row">
                <p className="break-words text-[2rem] font-extrabold tabular-nums leading-tight text-text-primary 2xl:text-[2.5rem] min-[137.5rem]:text-5xl">{k.exact ? <ExactAmount number={k.value} unit={k.unit ?? ''} exact={k.exact} /> : k.value}</p>
                <p className={`text-base leading-snug text-text-secondary 2xl:text-lg min-[137.5rem]:text-xl ${k.repeatsLabel ? 'sd-repeats' : ''} ${k.shortCaption ? 'sd-short-hide' : ''}`}>{k.caption}</p>
                {k.shortCaption && <p className={`sd-short-only text-base font-semibold leading-snug ${k.shortWarn ? 'text-amber-900' : 'text-text-secondary'}`}>{k.shortCaption}</p>}
              </div>
              {k.href && (
                <p className="sd-kpi-link inline-flex items-center gap-1 text-base font-semibold text-accent 2xl:text-lg min-[137.5rem]:text-xl">
                  {k.hrefLabel} <ArrowRight className="hidden size-4 2xl:block" aria-hidden="true" />
                </p>
              )}
            </>
          );
          const cls = `sd-kpi block rounded-xl border px-3.5 py-1.5 shadow-sm transition 2xl:px-5 2xl:py-3.5 ${k.tone}`;
          return k.href ? (
            <Link key={k.label} href={k.href} className={`${cls} hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`}>{body}</Link>
          ) : (
            <div key={k.label} className={cls}>{body}</div>
          );
        })}
      </section>

      <section aria-labelledby="monthly-results" className="sd-month-section space-y-2 2xl:space-y-3">
        <h2 id="monthly-results" className="text-xl font-bold text-text-primary 2xl:text-2xl min-[137.5rem]:text-3xl">Monthly Results<span className="sd-short-hide"> · </span> <span data-reporting-month className="sd-short-block">{monthName}</span></h2>
        <div className="sd-month-grid grid grid-cols-1 gap-3 md:grid-cols-3 2xl:gap-4">
          <article className="sd-month relative flex flex-col gap-0.5 rounded-xl border border-green-300 bg-green-50/70 px-4 py-2 shadow-sm 2xl:px-5 2xl:py-3" data-monthly-card="confirmed">
            <p className="flex items-center gap-2 text-lg font-semibold text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl"><Trophy className="sd-short-hide size-5 shrink-0 text-green-800" aria-hidden="true" /> Confirmed Enquiries <ArrowRight className="sd-open-arrow ml-auto hidden size-5 shrink-0 text-blue-800" aria-hidden="true" /></p>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[2rem] font-extrabold tabular-nums leading-tight text-text-primary 2xl:text-[2.5rem] min-[137.5rem]:text-5xl">{d.confirmedMonth.count}</span>
              <span className="sd-repeats text-base text-text-secondary 2xl:text-lg min-[137.5rem]:text-xl">Confirmed this month</span>
            </p>
            <Link href={`/sales/enquiries?status=WON&wonMonth=${d.month}`} className={`sd-month-link ${MONTHLY_LINK}`}>
              <span className="sd-month-link-text">View Confirmed Enquiries</span><span className="sr-only"> for {monthName}</span> <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </article>

          <article className="sd-month relative flex flex-col gap-0.5 rounded-xl border border-green-300 bg-green-50/70 px-4 py-2 shadow-sm 2xl:px-5 2xl:py-3" data-monthly-card="value">
            <p className="flex items-center gap-2 text-lg font-semibold text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl"><Banknote className="sd-short-hide size-5 shrink-0 text-green-800" aria-hidden="true" /> Estimated Value of Confirmed Enquiries</p>
            <p className="break-words text-[2rem] font-extrabold tabular-nums leading-tight text-text-primary 2xl:text-[2.5rem] min-[137.5rem]:text-5xl" data-confirmed-value={confirmedValue?.exact ?? ''}>
              {confirmedValue ? <><span className="mr-2 text-xl font-bold text-text-secondary 2xl:text-2xl">KWD</span>{confirmedValue.unit ? <ExactAmount number={confirmedValue.number} unit={confirmedValue.unit} exact={confirmedValue.exact} /> : confirmedValue.number}</> : d.confirmedMonth.count === 0 ? '—' : 'Not estimated'}
            </p>
            <p className="sd-repeats text-base text-text-secondary 2xl:text-lg min-[137.5rem]:text-xl">For enquiries confirmed this month</p>
            {d.confirmedMonth.withoutEstimate > 0 && d.confirmedMonth.count > 0 && (
              <p className="text-base font-semibold text-amber-900 2xl:text-lg min-[137.5rem]:text-xl" data-missing-estimates={d.confirmedMonth.withoutEstimate}>
                <span className="sd-short-hide">{d.confirmedMonth.withoutEstimate} confirmed {d.confirmedMonth.withoutEstimate === 1 ? 'enquiry has' : 'enquiries have'} no estimate, not counted</span>
                <span className="sd-short-only">{d.confirmedMonth.withoutEstimate} without estimate</span>
              </p>
            )}
          </article>

          <article className="sd-month relative flex flex-col gap-0.5 rounded-xl border border-green-300 bg-green-50/70 px-4 py-2 shadow-sm 2xl:px-5 2xl:py-3" data-monthly-card="contracts">
            <p className="flex items-center gap-2 text-lg font-semibold text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl"><FileCheck2 className="sd-short-hide size-5 shrink-0 text-green-800" aria-hidden="true" /> Contracts Created {d.contractsCreated !== null && <ArrowRight className="sd-open-arrow ml-auto hidden size-5 shrink-0 text-blue-800" aria-hidden="true" />}</p>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[2rem] font-extrabold tabular-nums leading-tight text-text-primary 2xl:text-[2.5rem] min-[137.5rem]:text-5xl">{d.contractsCreated ?? '—'}</span>
              <span className="text-base text-text-secondary 2xl:text-lg min-[137.5rem]:text-xl">{d.contractsCreated === null ? <><span className="sd-short-hide">Needs access to Contract Management</span><span className="sd-short-only">Needs contract access</span></> : <span className="sd-repeats">Created from enquiries this month</span>}</span>
            </p>
            {d.contractsCreated !== null && (
              <Link href={`/contracts?fromEnquiryMonth=${d.month}`} className={`sd-month-link ${MONTHLY_LINK}`}>
                <span className="sd-month-link-text">View Contracts</span><span className="sr-only"> created from enquiries in {monthName}</span> <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </article>
        </div>
      </section>

      <div className="sd-panels grid flex-1 content-start gap-3 xl:grid-cols-[4fr_5fr] 2xl:gap-4">
        <FollowUpsPanel
          due={due}
          dueTotal={d.followUpsDue}
          upcoming={d.upcomingFollowUps}
          upcomingTotal={d.upcomingFollowUpCount}
          activeWithoutFollowUp={d.activeWithoutFollowUp}
          today={d.today}
          canUpdate={canUpdate}
        />

        <RecentEnquiries
          initial={d.recentEnquiries}
          initialTotal={Object.values(d.statusCounts).reduce((n, c) => n + c, 0)}
          signature={signature}
          canCreate={canCreate}
          canUpdate={canUpdate}
          today={d.today}
          newButtonClass={NEW_BUTTON}
        />
      </div>
    </div>
  );
}
