import { FolderKanban, CheckCircle2, AlertTriangle, CircleDashed, CalendarClock, BadgeCheck } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractScheduleOverviewSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractScheduleOverviewSummary | null;
}

export function GlobalScheduleKpiStrip({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard label="Total Active Contracts" value={summary?.totalActiveContracts} icon={FolderKanban} iconColor="text-text-secondary" status={status} dense />
      <MetricCard label="On Track" value={summary?.onTrack} icon={CheckCircle2} iconColor="text-info" status={status} dense />
      <MetricCard label="Delayed" value={summary?.delayed} icon={AlertTriangle} iconColor="text-error" status={status} dense />
      <MetricCard label="Not Planned" value={summary?.notPlanned} icon={CircleDashed} iconColor="text-text-muted" status={status} dense />
      <MetricCard label="Due This Week" value={summary?.dueThisWeek} icon={CalendarClock} iconColor="text-warning" status={status} dense />
      <MetricCard label="Completed This Month" value={summary?.completedThisMonth} icon={BadgeCheck} iconColor="text-success" status={status} dense />
    </div>
  );
}
