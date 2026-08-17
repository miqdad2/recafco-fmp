import { DashboardRecentTable } from '../../../_components/dashboard-recent-table';
import type { ContractDashboardData } from '@/lib/contracts-api';

interface Props {
  data: ContractDashboardData | null;
}

export function TopContractsPanels({ data }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-text-primary mb-4">Recently Updated Contracts</h2>
      <DashboardRecentTable
        items={data?.recent.slice(0, 5) ?? []}
        baseHref="/contracts"
        emptyMessage="No contracts in scope."
      />
    </section>
  );
}
