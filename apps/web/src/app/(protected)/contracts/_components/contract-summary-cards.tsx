import { FileText, CheckCircle2, FileEdit } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../_components/metric-card';
import type { ContractSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractSummary | null;
  buildHref: (overrides: Record<string, string | undefined>) => string;
}

export function ContractSummaryCards({ summary, buildHref }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';
  const total = summary
    ? summary.totalDraft + summary.totalActive + summary.totalTerminated + summary.totalClosed
    : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <MetricCard
        label="Total Contracts"
        value={total}
        icon={FileText}
        iconColor="text-accent"
        href={buildHref({ lifecycleStatus: undefined, page: undefined })}
        status={status}
      />
      <MetricCard
        label="Active Contracts"
        value={summary?.totalActive}
        icon={CheckCircle2}
        iconColor="text-success"
        href={buildHref({ lifecycleStatus: 'ACTIVE', page: undefined })}
        status={status}
      />
      <MetricCard
        label="Draft Contracts"
        value={summary?.totalDraft}
        icon={FileEdit}
        iconColor="text-text-secondary"
        href={buildHref({ lifecycleStatus: 'DRAFT', page: undefined })}
        status={status}
      />
    </div>
  );
}
