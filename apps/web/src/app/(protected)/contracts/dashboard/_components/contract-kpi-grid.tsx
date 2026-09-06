import { FileText, CheckCircle2, FileEdit, Archive, CalendarClock } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { totalContractsFromMetrics } from '../_lib/dashboard-insights-helpers';

interface Props {
  data: ContractDashboardData | null;
  status: MetricStatus;
}

export function ContractKpiGrid({ data, status }: Props): React.JSX.Element {
  const m = data?.metrics;
  // CM-69H — "Total Working Contracts": Draft + Active only (via the shared
  // helper, so this card and the Manager grid/status donut never drift).
  // Terminated/Closed/Cancelled contracts are real, still-visible records
  // (Contract List's Lifecycle Status filter, the "Closed Contracts" card
  // below) — just no longer part of this working-view total.
  const totalWorkingContracts = m !== undefined ? totalContractsFromMetrics(m) : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
      <MetricCard
        label="Total Working Contracts"
        value={totalWorkingContracts}
        icon={FileText}
        iconColor="text-accent"
        href="/contracts"
        status={status}
        source="Cancelled contracts are excluded from working dashboard totals."
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
