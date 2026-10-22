import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarClock, ClipboardList, FolderOpen, Banknote, Trophy, Percent, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import { getCurrentUserContext } from '../contracts/_lib/get-user-permissions';
import { STATUS_LABELS, STATUS_ORDER, STATUS_FILTER_VALUE, dueText, foldStatusCounts, formatDate, formatKwd, formatMonth, formatRate } from './_lib/sales-format';
import { BucketBadge, EmptyState, Section, StatusBadge } from './_components/sales-ui';
import { NewEnquiryButton } from './_components/new-enquiry-modal';

export const metadata: Metadata = { title: 'Sales & Enquiries — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface Kpi {
  label: string;
  value: string;
  caption?: string | undefined;
  icon: LucideIcon;
  /** Tailwind classes for the card tint / icon chip. */
  tone: string;
  chip: string;
  href?: string | undefined;
}

/**
 * FMP-SALES-01C — the Sales dashboard, kept deliberately simple for a manager in a meeting: six plain
 * figures, the follow-ups that need attention, the latest enquiries, and one slim line of status counts.
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
  const monthName = formatMonth(d.month);
  const estimated = formatKwd(d.potentialValue);
  const counts = foldStatusCounts(d.statusCounts);
  const anyStatus = STATUS_ORDER.some((s) => counts[s] > 0);

  const kpis: Kpi[] = [
    { label: 'Enquiries This Month', value: String(d.enquiriesThisMonth), caption: monthName, icon: ClipboardList, tone: 'border-blue-200 bg-blue-50/60', chip: 'bg-blue-100 text-blue-700', href: `/sales/enquiries?month=${d.month}` },
    {
      label: 'Follow-ups Due',
      value: String(d.followUpsDue),
      caption: d.followUpsDue === 0 ? 'Nothing due today' : d.followUpsOverdue > 0 ? `${d.followUpsOverdue} overdue` : 'Due today',
      icon: CalendarClock,
      tone: d.followUpsOverdue > 0 ? 'border-red-300 bg-red-50/60' : 'border-amber-300 bg-amber-50/60',
      chip: d.followUpsOverdue > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
      href: '/sales/follow-ups',
    },
    { label: 'Active Enquiries', value: String(d.openEnquiries), caption: 'Still being discussed', icon: FolderOpen, tone: 'border-blue-200 bg-blue-50/60', chip: 'bg-blue-100 text-blue-700', href: '/sales/enquiries?status=open' },
    {
      label: 'Estimated Project Value',
      value: estimated ?? '—',
      caption: d.openWithoutEstimate > 0
        ? `${d.openWithoutEstimate} ${d.openWithoutEstimate === 1 ? 'enquiry has' : 'enquiries have'} no estimate yet`
        : estimated ? 'Active enquiries' : 'No estimates entered yet',
      icon: Banknote,
      tone: 'border-purple-200 bg-purple-50/60',
      chip: 'bg-purple-100 text-purple-700',
    },
    { label: 'Confirmed Projects', value: String(d.projectsWon), caption: `Confirmed in ${monthName}`, icon: Trophy, tone: 'border-green-300 bg-green-50/60', chip: 'bg-green-100 text-green-700', href: '/sales/enquiries?status=WON' },
  ];
  if (d.conversion) {
    kpis.push({
      label: 'Conversion This Month',
      value: formatRate(d.conversion.rate),
      caption: d.conversion.rate === null
        ? `No enquiries in ${monthName} yet`
        : `${d.conversion.won} of ${d.conversion.created} enquiries from ${monthName} confirmed`,
      icon: Percent,
      tone: 'border-green-300 bg-green-50/60',
      chip: 'bg-green-100 text-green-700',
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary">Sales &amp; Enquiries</h1>
          <p className="mt-1 text-xl text-text-secondary">Client meetings, new opportunities and follow-ups.</p>
        </div>
        {canCreate && <NewEnquiryButton className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3 text-xl font-bold text-white shadow-md transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2" />}
      </div>

      <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => {
          const body = (
            <div className="flex items-start gap-4">
              <span className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${k.chip}`}>
                <k.icon className="size-7" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-text-secondary">{k.label}</p>
                <p className="break-words text-4xl font-extrabold tabular-nums leading-tight text-text-primary">{k.value}</p>
                {k.caption && <p className="text-base leading-snug text-text-secondary">{k.caption}</p>}
              </div>
            </div>
          );
          const cls = `block rounded-xl border p-5 shadow-sm transition ${k.tone}`;
          return k.href ? (
            <Link key={k.label} href={k.href} className={`${cls} hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus`}>{body}</Link>
          ) : (
            <div key={k.label} className={cls}>{body}</div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Follow-ups to Do"
          aside={<Link href="/sales/follow-ups" className="inline-flex items-center gap-1 text-lg font-semibold text-accent hover:underline">See all <ArrowRight className="size-5" aria-hidden="true" /></Link>}
        >
          {d.followUpsNeedingAttention.length === 0 ? (
            <p className="rounded-lg bg-green-50 px-5 py-6 text-lg font-medium text-green-800">All up to date. Nothing is overdue or due today.</p>
          ) : (
            <ul className="space-y-3">
              {d.followUpsNeedingAttention.map((f) => (
                <li key={f.id} className={`rounded-xl border-l-8 bg-surface-secondary/50 p-4 ${f.bucket === 'OVERDUE' ? 'border-red-500' : 'border-amber-500'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-xl font-bold text-text-primary">{f.enquiry.companyName}</p>
                      <p className="text-base text-text-secondary">{[f.enquiry.contactPerson, f.enquiry.contactNumber].filter(Boolean).join(' · ') || 'No contact saved'}</p>
                      {f.notes && <p className="mt-1 line-clamp-2 text-base text-text-primary">{f.notes}</p>}
                    </div>
                    <div className="text-right">
                      <BucketBadge bucket={f.bucket} />
                      <p className="mt-1 text-base font-semibold text-text-primary">{formatDate(f.followUpDate)}</p>
                      <p className="text-sm text-text-secondary">{dueText(f.bucket, f.followUpDate, d.today)}</p>
                    </div>
                  </div>
                  <Link href={`/sales/enquiries/${f.enquiry.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-surface px-5 text-base font-semibold hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
                    Open Enquiry
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Recent Enquiries"
          aside={<Link href="/sales/enquiries" className="inline-flex items-center gap-1 text-lg font-semibold text-accent hover:underline">See all <ArrowRight className="size-5" aria-hidden="true" /></Link>}
        >
          {d.recentEnquiries.length === 0 ? (
            <EmptyState
              title="No enquiries yet"
              text="When a client visits, click “+ New Client Enquiry” and save their details. It takes less than a minute."
              actionNode={canCreate ? <NewEnquiryButton className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3 text-xl font-bold text-white shadow-md transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2" /> : undefined}
            />
          ) : (
            <ul className="divide-y divide-border">
              {d.recentEnquiries.map((e) => (
                <li key={e.id}>
                  <Link href={`/sales/enquiries/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    <div className="min-w-0">
                      <p className="break-words text-xl font-bold text-text-primary">{e.companyName}</p>
                      <p className="text-base text-text-secondary">{formatDate(e.enquiryDate)}{e.projectName ? ` · ${e.projectName}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold text-purple-800">{formatKwd(e.estimatedValue) ?? 'Not estimated yet'}</span>
                      <StatusBadge status={e.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {anyStatus && (
        <nav aria-label="Enquiries by status" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-lg font-semibold text-text-secondary">By status:</span>
          {STATUS_ORDER.map((s) => (
            <Link key={s} href={`/sales/enquiries?status=${STATUS_FILTER_VALUE[s]}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-base font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
              {STATUS_LABELS[s]}
              <span className="rounded-full bg-surface-secondary px-2 text-base font-bold tabular-nums">{counts[s]}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
