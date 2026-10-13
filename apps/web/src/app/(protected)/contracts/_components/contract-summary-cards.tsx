import { FileText, CheckCircle2, Wallet, AlertTriangle } from 'lucide-react';
import { DashboardKpiCard } from '../dashboard/_components/dashboard-kpi-card';
import { formatKwdCompact } from '../dashboard/_lib/dashboard-insights-helpers';
import type { MetricStatus } from '../../_components/metric-card';
import type { ContractSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractSummary | null;
  /** Contracts on the page being shown that need a look (see attentionReasons()). */
  needsAttention: number;
  buildHref: (overrides: Record<string, string | undefined>) => string;
}

// FMP-UI-40 — the 4th card is now Needs Attention (it replaced Open Claims, which is
// still one of the reasons a contract is flagged). The API has no attention count,
// so it counts the contracts on the page being shown.
// CM-55 — approved-design Contract List KPI row: 4 cards only (Avg. Physical
// Progress removed — no honest per-contract-average progress figure exists
// without inventing one). Reuses the same DashboardKpiCard the Contract
// Manager Dashboard (CM-54) already established, for one consistent
// executive-dashboard visual language across both pages.
// CM-69I — `summary` is now computed server-side over the EXACT same
// filtered scope as the table below it (see contracts/page.tsx's shared
// `filterParams` passed to both list() and summary()) — no more manual
// per-status sum here; `summary.totalContracts`/`activeContracts` already
// are the real, current-filter-matching counts. "Total Contracts"'s subtext
// now says so explicitly, since it's no longer an unconditional grand total.
export function ContractSummaryCards({ summary, needsAttention, buildHref }: Props): React.JSX.Element {
  const status: MetricStatus = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardKpiCard
        label="Total Contracts" value={summary?.totalContracts} icon={FileText} accent="info" status={status}
        subtext="Matching current filters" href={buildHref({ lifecycleStatus: undefined, page: undefined })}
      />
      <DashboardKpiCard
        label="Active Contracts" value={summary?.activeContracts} icon={CheckCircle2} accent="success" status={status}
        subtext="In Progress" href={buildHref({ lifecycleStatus: 'ACTIVE', page: undefined })}
      />
      <DashboardKpiCard
        label="Total Contract Value" value={formatKwdCompact(summary ? Number(summary.totalContractValue) : undefined)} icon={Wallet} accent="team-production" status={status}
        subtext="KWD"
      />
      <DashboardKpiCard
        label="Needs Attention" value={needsAttention} icon={AlertTriangle} accent={needsAttention > 0 ? 'warning' : 'success'} status="ok"
        subtext="On this page"
      />
    </div>
  );
}
