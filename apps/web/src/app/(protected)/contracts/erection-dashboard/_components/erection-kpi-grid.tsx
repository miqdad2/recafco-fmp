import { HardHat, FileClock, Send, CheckCircle2, Construction, AlertTriangle, ClipboardList, CircleDollarSign } from 'lucide-react';
import { DashboardKpiCard } from '../../dashboard/_components/dashboard-kpi-card';
import type { MetricStatus } from '../../../_components/metric-card';
import type { ErectionDashboardData } from '@/lib/contracts-api';

interface Props {
  data: ErectionDashboardData | null;
  status: MetricStatus;
}

/**
 * CM-71B — 8-card KPI strip for the Erection Manager Dashboard. Reuses the
 * exact same DashboardKpiCard component as the Contract Manager Dashboard
 * (CM-54) — no new card component needed, since it already accepts a plain
 * string value alongside a number.
 *
 * CM-71G — Checklist Pending is now a REAL count (Step 6 Draft/Submitted-
 * but-not-verified records), no longer a fixed placeholder, now that a
 * dedicated Step 6 model exists. Payment Pending After Erection remains a
 * fixed "Not started" placeholder, never a fabricated count, since Step 7
 * has no dedicated screen/model yet.
 */
export function ErectionKpiGrid({ data, status }: Props): React.JSX.Element {
  const kpis = data?.kpis;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <DashboardKpiCard
        label="Total Erection Contracts" value={kpis?.totalErectionContracts} icon={HardHat} accent="info" status={status}
        subtext="Scope includes Erection, or has erection workflow data" href="/contracts/erection-dashboard"
      />
      <DashboardKpiCard
        label="Method Statement Pending" value={kpis?.methodStatementPending} icon={FileClock} accent="warning" status={status}
        subtext="Not started or still in Draft"
      />
      <DashboardKpiCard
        label="Submitted for Approval" value={kpis?.submittedForApproval} icon={Send} accent="info" status={status}
        subtext="Awaiting client approval"
      />
      <DashboardKpiCard
        label="Ready for Erection" value={kpis?.readyForErection} icon={CheckCircle2} accent="success" status={status}
        subtext="Delivery started, erection not started yet"
      />
      <DashboardKpiCard
        label="Erection In Progress" value={kpis?.erectionInProgress} icon={Construction} accent="team-production" status={status}
        subtext="Erection Start (Step 5) confirmed"
      />
      <DashboardKpiCard
        label="Delayed / Attention Required" value={kpis?.delayedAttentionRequired} icon={AlertTriangle} accent="error" status={status}
        subtext="Overdue planned date or overdue erection task"
      />
      <DashboardKpiCard
        label="Checklist Pending" value={kpis?.checklistPending} icon={ClipboardList} accent="warning" status={status}
        subtext="Draft or Submitted, not yet Verified"
      />
      <DashboardKpiCard
        label="Payment Pending After Erection" value={kpis ? 'Not started' : undefined} icon={CircleDollarSign} accent="teal" status={status}
        subtext="Payment Issued (Step 7) not built yet"
      />
    </div>
  );
}
