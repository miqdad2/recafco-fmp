import { FolderOpen, FileInput, CheckCircle2, Wallet } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractClaimSummary } from '@/lib/contracts-api';
import { formatContractValue } from '../../_lib/contract-ui-helpers';

interface Props {
  summary: ContractClaimSummary | null;
}

// FMP-CLAIM-01 — four cards. Overdue and Closed/Settled counts remain in the API
// summary and are reachable via the Overdue / Closed filters. The three value
// cards are sums of claim values (money) only; Extension of Time days are never
// added in. Outstanding excludes Rejected and Cancelled claims (backend rule).
export function ClaimSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Open Claims" value={summary?.openClaims} icon={FolderOpen} iconColor="text-text-secondary" status={status} />
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
    </div>
  );
}
