import { HardHat, CheckCircle2, Construction, AlertTriangle } from 'lucide-react';
import type { MetricStatus } from '../../../_components/metric-card';
import type { ErectionDashboardData } from '@/lib/contracts-api';
import { ErectionOverviewCard } from './erection-overview-card';

interface Props {
  data: ErectionDashboardData | null;
  status: MetricStatus;
  needsAttentionCount: number;
}

/**
 * FMP-UI-19 — the dashboard's own "answer in 10 seconds" overview: exactly 4
 * cards, replacing the old 8-card KPI strip (erection-kpi-grid.tsx, deleted)
 * that mixed step-level detail into the top-level overview. `needsAttentionCount`
 * is computed by the caller from the same work queue rows the Needs
 * Attention section renders — the card and the section it summarizes always
 * agree, since both come from selectErectionNeedsAttention() over the same
 * fetched data.
 *
 * FMP-UI-19D — relabeled per required business wording ("Erection
 * Contracts" → "Contracts in Erection Workflow"; "Ready for Erection" →
 * "Ready to Start Erection"; "In Progress" → "Erection In Progress").
 *
 * FMP-UI-19E — switched from `DashboardKpiCard`'s generic `dense` layout to
 * the bespoke `ErectionOverviewCard` (see its own doc comment) for
 * management-ready polish: identical icon size/card height across all 4,
 * a clearer value→label→helper hierarchy, and — per this unit's own "Needs
 * Attention should be visually more noticeable" requirement — a soft red
 * card tone on that one card only (`attention` prop), never on the other 3.
 */
export function ErectionOverviewCards({ data, status, needsAttentionCount }: Props): React.JSX.Element {
  const kpis = data?.kpis;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <ErectionOverviewCard
        label="Contracts in Erection Workflow"
        value={kpis?.totalErectionContracts}
        helperText="Contracts with Erection scope"
        icon={HardHat}
        iconClassName="bg-info-light text-info"
        status={status}
      />
      <ErectionOverviewCard
        label="Ready to Start Erection"
        value={kpis?.readyForErection}
        helperText="Delivery started, not yet erected"
        icon={CheckCircle2}
        iconClassName="bg-success-light text-success"
        status={status}
      />
      <ErectionOverviewCard
        label="Erection In Progress"
        value={kpis?.erectionInProgress}
        helperText="Erection Start confirmed"
        icon={Construction}
        iconClassName="bg-team-production-light text-team-production"
        status={status}
      />
      <ErectionOverviewCard
        label="Needs Attention"
        value={data ? needsAttentionCount : undefined}
        helperText="Overdue, awaiting approval, or planning"
        icon={AlertTriangle}
        iconClassName="bg-error-light text-error"
        status={status}
        attention
      />
    </div>
  );
}
