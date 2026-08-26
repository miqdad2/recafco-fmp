import { ListChecks, CalendarClock, CalendarCheck2, AlertTriangle, ListTodo, Wallet, MessageSquareWarning, FlagOff } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ScheduleSummary } from '@/lib/contracts-api';

interface Props {
  summary: ScheduleSummary | null;
}

export function ScheduleSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
      <MetricCard label="Total Schedule Items" value={summary?.totalItems} icon={ListChecks} iconColor="text-accent" status={status} />
      <MetricCard label="Upcoming This Week" value={summary?.upcomingThisWeek} icon={CalendarClock} iconColor="text-info" status={status} />
      <MetricCard label="Due Today" value={summary?.dueToday} icon={CalendarCheck2} iconColor="text-warning" status={status} />
      <MetricCard label="Overdue Items" value={summary?.overdueItems} icon={AlertTriangle} iconColor="text-danger" status={status} />
      <MetricCard label="Workflow Due" value={summary?.workflowDue} icon={ListTodo} iconColor="text-text-secondary" status={status} />
      <MetricCard label="Payment Due" value={summary?.paymentDue} icon={Wallet} iconColor="text-text-secondary" status={status} />
      <MetricCard label="Issue / Claim Due" value={summary?.issueClaimDue} icon={MessageSquareWarning} iconColor="text-text-secondary" status={status} />
      <MetricCard label="Contracts Ending Soon" value={summary?.contractsEndingSoon} icon={FlagOff} iconColor="text-warning" status={status} />
    </div>
  );
}
