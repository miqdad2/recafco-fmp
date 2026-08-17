import { FileText, CheckCircle2, FileEdit, Archive, CalendarClock } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractDashboardData } from '@/lib/contracts-api';

interface Props {
  data: ContractDashboardData | null;
  status: MetricStatus;
}

export function ContractKpiGrid({ data, status }: Props): React.JSX.Element {
  const m = data?.metrics;
  const totalContracts =
    m !== undefined
      ? m.totalDraft + m.totalActive + m.totalExpiring + m.totalExpired + m.totalTerminated + m.totalClosed
      : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
      <MetricCard
        label="Total Contracts"
        value={totalContracts}
        icon={FileText}
        iconColor="text-accent"
        href="/contracts"
        status={status}
      />
      <MetricCard
        label="Active Contracts"
        value={m?.totalActive}
        icon={CheckCircle2}
        iconColor="text-success"
        href="/contracts?lifecycleStatus=ACTIVE"
        status={status}
      />
      <MetricCard
        label="Draft Contracts"
        value={m?.totalDraft}
        icon={FileEdit}
        iconColor="text-text-secondary"
        href="/contracts?lifecycleStatus=DRAFT"
        status={status}
      />
      <MetricCard
        label="Closed Contracts"
        value={m?.totalClosed}
        icon={Archive}
        iconColor="text-text-secondary"
        href="/contracts?lifecycleStatus=CLOSED"
        status={status}
      />
      <MetricCard
        label="Contracts Closing Soon"
        value={m?.totalExpiring}
        icon={CalendarClock}
        iconColor="text-warning"
        href="/contracts?lifecycleStatus=EXPIRING"
        status={status}
        source="Active contracts past their renewal notice date"
      />
    </div>
  );
}
