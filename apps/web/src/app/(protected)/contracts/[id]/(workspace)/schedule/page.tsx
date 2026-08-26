import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ScheduleTimelineView } from '../../../schedule/_components/schedule-timeline-view';

export const metadata: Metadata = { title: 'Schedule — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractScheduleTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, detail] = await Promise.all([
    getUserPermissions(),
    contractsApi.getContractSchedule(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !detail) notFound();

  const { items, summary } = detail;

  const statusRows: { label: string; value: number }[] = [
    { label: 'Total Items', value: summary.totalItems },
    { label: 'Upcoming This Week', value: summary.upcomingThisWeek },
    { label: 'Due Today', value: summary.dueToday },
    { label: 'Overdue Items', value: summary.overdueItems },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Schedule</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Contract timeline, workflow due dates, payments, issues, claims and closeout milestones for this contract.
          </p>
        </div>
        <Link
          href={`/contracts/schedule?contractId=${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Open in Schedule Register
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      {/* Schedule Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Schedule Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {statusRows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-text-muted">{row.label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Timeline */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Timeline</h2>
        <ScheduleTimelineView items={items} />
      </section>
    </div>
  );
}
