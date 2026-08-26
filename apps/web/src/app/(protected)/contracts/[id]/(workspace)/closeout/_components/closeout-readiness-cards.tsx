import { ListTodo, AlertTriangle, MessageSquareWarning, FileWarning, Wallet, FileCheck2 } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../../../_components/metric-card';
import type { ContractCloseoutChecks } from '@/lib/contracts-api';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';

interface Props {
  checks: ContractCloseoutChecks | null;
}

export function CloseoutReadinessCards({ checks }: Props): React.JSX.Element {
  const status: MetricStatus = checks ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard
        label="Workflow Tasks Open"
        value={checks?.workflow.open}
        icon={ListTodo}
        iconColor={checks && checks.workflow.open > 0 ? 'text-warning' : 'text-success'}
        status={status}
      />
      <MetricCard
        label="Workflow Tasks Overdue"
        value={checks?.workflow.overdue}
        icon={AlertTriangle}
        iconColor={checks && checks.workflow.overdue > 0 ? 'text-danger' : 'text-success'}
        status={status}
      />
      <MetricCard
        label="Open Issues"
        value={checks?.issues.open}
        icon={MessageSquareWarning}
        iconColor={checks && checks.issues.open > 0 ? 'text-warning' : 'text-success'}
        status={status}
      />
      <MetricCard
        label="Open Claims"
        value={checks?.claims.open}
        icon={FileWarning}
        iconColor={checks && checks.claims.open > 0 ? 'text-warning' : 'text-success'}
        status={status}
      />
      <MetricCard
        label="Outstanding Payment"
        value={checks ? formatContractValue(checks.payments.outstandingAmount, 'KWD') : undefined}
        icon={Wallet}
        iconColor={checks && Number(checks.payments.outstandingAmount) > 0 ? 'text-warning' : 'text-success'}
        status={status}
      />
      <MetricCard
        label="Closeout Documents"
        value={checks?.documents.count}
        icon={FileCheck2}
        iconColor={checks && checks.documents.count > 0 ? 'text-success' : 'text-text-secondary'}
        status={status}
      />
    </div>
  );
}
