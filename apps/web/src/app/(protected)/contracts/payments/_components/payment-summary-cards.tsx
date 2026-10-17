import { FileInput, Wallet, Scale, AlertTriangle } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ContractPaymentSummary } from '@/lib/contracts-api';
import { formatContractValue } from '../../_lib/contract-ui-helpers';

interface Props {
  summary: ContractPaymentSummary | null;
}

export function PaymentSummaryCards({ summary }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    // Total Certified is intentionally not a card (FMP-PAY-01): it stays in each
    // payment's details and in the CSV/print register.
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Submitted"
        value={summary ? formatContractValue(summary.totalSubmitted, 'KWD') : undefined}
        icon={FileInput}
        iconColor="text-text-secondary"
        status={status}
      />
      <MetricCard
        label="Total Paid"
        value={summary ? formatContractValue(summary.totalPaid, 'KWD') : undefined}
        icon={Wallet}
        iconColor="text-success"
        status={status}
      />
      <MetricCard
        label="Total Outstanding"
        value={summary ? formatContractValue(summary.totalOutstanding, 'KWD') : undefined}
        icon={Scale}
        iconColor="text-warning"
        status={status}
      />
      <MetricCard
        label="Overdue Payments"
        value={summary ? `${summary.overdueCount} (${formatContractValue(summary.overdueValue, 'KWD')})` : undefined}
        icon={AlertTriangle}
        iconColor="text-error"
        status={status}
      />
    </div>
  );
}
