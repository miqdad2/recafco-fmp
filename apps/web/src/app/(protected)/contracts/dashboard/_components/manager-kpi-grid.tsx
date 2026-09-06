import {
  FileText, CheckCircle2, Wallet, Gauge, FileUp, BadgeCheck, CircleDollarSign,
  AlertTriangle, ClockAlert, MessageSquareWarning, CalendarClock,
} from 'lucide-react';
import { DashboardKpiCard } from './dashboard-kpi-card';
import type { MetricStatus } from '../../../_components/metric-card';
import { formatKwdCompact, computeOverallProgressPercent, totalContractsFromMetrics } from '../_lib/dashboard-insights-helpers';
import type { ContractDashboardData } from '@/lib/contracts-api';

interface Props {
  data: ContractDashboardData | null;
  status: MetricStatus;
}

/**
 * CM-54 — approved-design KPI grid (11 cards). `grid-cols-6` on desktop puts
 * cards 7-11 on a second row automatically, with Open Claims placed 7th so
 * it lands on that second line per the approved-design change request.
 * CM-54C — icon set upgraded to a fully distinct, more semantically precise
 * lucide-react icon per card (e.g. ClockAlert for overdue-by-time vs.
 * AlertTriangle for a general critical-attention flag — no two cards share
 * an icon), plus a dedicated `teal` accent for the payment-flow card family
 * so it reads distinctly from the general "contracts" blue.
 * CM-54D — grid gap tightened back down (CM-54C's widened gap read a touch
 * loose once the cards themselves got more compact); values/labels/hrefs
 * unchanged.
 */
export function ManagerKpiGrid({ data, status }: Props): React.JSX.Element {
  const metrics = data?.metrics;
  const summary = data?.manager?.summary;
  const insights = data?.manager?.insights;
  const financials = insights?.financials;
  const overallProgress = data?.manager?.workflowOverview ? computeOverallProgressPercent(data.manager.workflowOverview) : undefined;
  const totalContracts = metrics ? totalContractsFromMetrics(metrics) : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <DashboardKpiCard
        label="Total Working Contracts" value={totalContracts} icon={FileText} accent="info" status={status}
        subtext="Active working view — cancelled contracts excluded" href="/contracts"
        secondaryLine={metrics ? `Active: ${metrics.totalActive} · Draft: ${metrics.totalDraft}` : undefined}
      />
      <DashboardKpiCard
        label="Active Contracts" value={summary?.activeContracts} icon={CheckCircle2} accent="success" status={status}
        subtext="In progress" href="/contracts?lifecycleStatus=ACTIVE"
      />
      <DashboardKpiCard
        label="Total Contract Value" value={formatKwdCompact(financials?.contractValueTotal)} icon={Wallet} accent="team-production" status={status}
        subtext="Current value" href="/contracts"
        secondaryLine={financials ? `Original: ${formatKwdCompact(financials.originalContractValueTotal)}` : undefined}
      />
      <DashboardKpiCard
        label="Overall Progress" value={overallProgress !== undefined ? `${overallProgress}%` : undefined} icon={Gauge} accent="warning" status={status}
        subtext="Workflow task completion" href="/contracts/workflow"
      />
      <DashboardKpiCard
        label="Submitted Invoices" value={formatKwdCompact(financials?.submittedTotal)} icon={FileUp} accent="teal" status={status}
        subtext="Submitted to client" href="/contracts/payments"
      />
      <DashboardKpiCard
        label="Received Payments" value={formatKwdCompact(financials?.paidTotal)} icon={BadgeCheck} accent="success" status={status}
        subtext="Paid by client" href="/contracts/payments"
      />
      <DashboardKpiCard
        label="Open Claims" value={summary?.openClaims} icon={MessageSquareWarning} accent="error" status={status}
        subtext="Awaiting resolution" href="/contracts/claims"
        secondaryLine={financials ? `Value: ${formatKwdCompact(financials.openClaimsValue)}` : undefined}
      />
      <DashboardKpiCard
        label="Outstanding Payment" value={formatKwdCompact(financials?.outstandingTotal)} icon={CircleDollarSign} accent="warning" status={status}
        subtext="Submitted but not received" href="/contracts/payments"
      />
      <DashboardKpiCard
        label="Critical Project Contracts" value={insights?.criticalProjectContracts} icon={AlertTriangle} accent="error" status={status}
        subtext="Require attention" href="/contracts"
      />
      <DashboardKpiCard
        label="Overdue Workflow Tasks" value={summary?.overdueWorkflowTasks} icon={ClockAlert} accent="warning" status={status}
        subtext="Require action" href="/contracts/workflow?overdueOnly=true"
      />
      <DashboardKpiCard
        label="Contracts Closing Soon" value={insights?.contractsClosingSoon} icon={CalendarClock} accent="team-production" status={status}
        subtext="In next 60 days" href="/contracts"
      />
    </div>
  );
}
