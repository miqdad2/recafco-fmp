import { FolderOpen, FileInput, CheckCircle2, Wallet, Clock, Archive } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractClaimSummary } from '@/lib/contracts-api';
import { formatContractValue } from '../../_lib/contract-ui-helpers';

interface Props {
  summary: ContractClaimSummary | null;
}

export function ClaimSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
      <MetricCard
        label="Open Claims"
        value={summary?.openClaims}
        icon={FolderOpen}
        iconColor="text-text-secondary"
        status={status}
      />
      <MetricCard
        label="Submitted Value"
        value={summary ? formatContractValue(summary.totalSubmittedValue, 'KWD') : undefined}
        icon={FileInput}
        iconColor="text-accent"
        status={status}
      />
      <MetricCard
        label="Approved Value"
        value={summary ? formatContractValue(summary.totalApprovedValue, 'KWD') : undefined}
        icon={CheckCircle2}
        iconColor="text-success"
        status={status}
      />
      <MetricCard
        label="Outstanding Value"
        value={summary ? formatContractValue(summary.totalOutstandingValue, 'KWD') : undefined}
        icon={Wallet}
        iconColor="text-warning"
        status={status}
      />
      <MetricCard
        label="Overdue Claims"
        value={summary?.overdueClaims}
        icon={Clock}
        iconColor="text-error"
        status={status}
      />
      <MetricCard
        label="Closed / Settled Claims"
        value={summary?.closedOrSettledClaims}
        icon={Archive}
        iconColor="text-text-muted"
        status={status}
      />
    </div>
  );
}
