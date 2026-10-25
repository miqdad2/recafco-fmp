import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarClock, FolderOpen, FilePlus2, Banknote, Trophy, Percent, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import { getCurrentUserContext } from '../contracts/_lib/get-user-permissions';
import { formatKwd, formatMonth, formatRate } from './_lib/sales-format';
import { RecentEnquiries } from './_components/recent-enquiries';
import { FollowUpsPanel } from './_components/follow-ups-panel';
import { DashboardClock } from './_components/dashboard-clock';

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
}

const NEW_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2 text-xl font-bold text-white shadow-md transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';

/**
 * FMP-SALES-06 — the Sales Activities dashboard. Order: heading and New Client Enquiry, four summary cards, the compact
 * Monthly Results strip, then Today's Follow-ups beside Recent Enquiries. Metric definitions are unchanged. The reporting
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
  const due = d.followUpsNeedingAttention;
  // Changes whenever anything shown here changes, so the client-side Recent Enquiries list reloads itself.
  const signature = JSON.stringify([d.month, d.recentEnquiries.map((e) => [e.id, e.status, e.nextFollowUpDate, e.updatedAt, e.latestActivity?.id ?? null]), d.openEnquiries, d.followUpsDue, d.enquiriesThisMonth]);

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
        ? `${d.openWithoutEstimate} active ${d.openWithoutEstimate === 1 ? 'enquiry has' : 'enquiries have'} no estimate, not counted`
        : estimated ? 'Active enquiries only' : 'No estimates entered yet',
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
                <p className="text-lg font-semibold leading-snug text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">{k.label}</p>
                <span className={`hidden size-9 shrink-0 items-center justify-center rounded-lg 2xl:flex ${k.chip}`}>
                  <k.icon className="size-5" aria-hidden="true" />
                </span>
              </div>
              <p className="break-words text-[2rem] font-extrabold tabular-nums leading-tight text-text-primary 2xl:text-[2.5rem] min-[137.5rem]:text-5xl">{k.value}</p>
              <p className="text-base leading-snug text-text-secondary 2xl:text-lg min-[137.5rem]:text-xl">{k.caption}</p>
              {k.href && (
                <p className="inline-flex items-center gap-1 text-base font-semibold text-accent 2xl:text-lg min-[137.5rem]:text-xl">
                  {k.hrefLabel} <ArrowRight className="hidden size-4 2xl:block" aria-hidden="true" />
                </p>
              )}
            </>
          );
          const cls = `block rounded-xl border px-3.5 py-1.5 shadow-sm transition 2xl:px-5 2xl:py-3.5 ${k.tone}`;
          return k.href ? (
            <Link key={k.label} href={k.href} className={`${cls} hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`}>{body}</Link>
          ) : (
            <div key={k.label} className={cls}>{body}</div>
          );
        })}
      </section>

      <section aria-labelledby="monthly-results" className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-green-200 bg-green-50/50 px-4 py-1 2xl:py-2">
        <h2 id="monthly-results" className="text-lg font-bold text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">Monthly Results <span className="font-medium text-text-secondary">— <span data-reporting-month>{monthName}</span></span></h2>
        <div className="flex items-center gap-2">
          <Trophy className="size-5 shrink-0 text-green-800" aria-hidden="true" />
          <p className="text-lg text-text-primary"><span className="font-semibold">Confirmed Projects</span> <span className="ml-1 text-2xl font-extrabold tabular-nums">{d.projectsWon}</span></p>
        </div>
        {d.conversion && (
          <div className="flex items-center gap-2">
            <Percent className="size-5 shrink-0 text-green-800" aria-hidden="true" />
            <p className="text-lg text-text-primary">
              <span className="font-semibold">Conversion This Month</span> <span className="ml-1 text-2xl font-extrabold tabular-nums">{formatRate(d.conversion.rate)}</span>{' '}
              <span className="text-base text-text-secondary">
                {d.conversion.rate === null ? `No enquiries in ${monthName} yet` : `${d.conversion.won} of ${d.conversion.created} confirmed`}
              </span>
            </p>
          </div>
        )}
      </section>

      <div className="grid flex-1 content-start gap-3 xl:grid-cols-[4fr_5fr] 2xl:gap-4">
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
