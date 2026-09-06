import { Gauge, Wallet, HandCoins, ShieldAlert, FileText, MessageSquareWarning } from 'lucide-react';
import { DashboardKpiCard } from '../../../../../contracts/dashboard/_components/dashboard-kpi-card';
import type { MetricStatus } from '../../../../../_components/metric-card';

interface Props {
  /** Real overall workflow completion percent (contract-overview-helpers.ts computeOverallProgress) — undefined only when the workflow summary itself failed to load. */
  overallCompletionPercent: number | undefined;
  /** Real payment-progress percent (contract-overview-helpers.ts computePaymentProgressPercent). */
  paymentCompletionPercent: number | undefined;
  openClaims: number | undefined;
  openRisks: number | undefined;
  pendingDocuments: number | undefined;
  openIssues: number | undefined;
}

function statusFor(v: number | undefined): MetricStatus {
  return v === undefined ? 'unavailable' : 'ok';
}

/**
 * CM-67 — Readiness KPI strip. Every value is a real computed/aggregated
 * number already used elsewhere in this app (Overview's own workflow/
 * payment progress formulas, the real per-module open counts) — never a
 * newly-invented metric. Accent colors match each metric's own tab exactly
 * (Open Claims=info per Claims tab, Open Risks/Pending Documents/Open
 * Issues=warning per their own tabs) rather than a value-conditional color,
 * consistent with every other KPI strip built this session. A metric shows
 * "—" only when its real source genuinely failed to load.
 */
export function ContractCloseoutKpiStrip({
  overallCompletionPercent,
  paymentCompletionPercent,
  openClaims,
  openRisks,
  pendingDocuments,
  openIssues,
}: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <DashboardKpiCard
        label="Overall Completion"
        value={overallCompletionPercent !== undefined ? `${overallCompletionPercent}%` : undefined}
        icon={Gauge}
        accent="info"
        valueClassName="text-info"
        subtext="Workflow tasks"
        status={statusFor(overallCompletionPercent)}
        dense
      />
      <DashboardKpiCard
        label="Payment Completion"
        value={paymentCompletionPercent !== undefined ? `${paymentCompletionPercent}%` : undefined}
        icon={Wallet}
        accent="teal"
        valueClassName="text-teal"
        subtext="Of contract value"
        status={statusFor(paymentCompletionPercent)}
        dense
      />
      <DashboardKpiCard
        label="Open Claims"
        value={openClaims}
        icon={HandCoins}
        accent="info"
        valueClassName="text-info"
        status={statusFor(openClaims)}
        dense
      />
      <DashboardKpiCard
        label="Open Risks"
        value={openRisks}
        icon={ShieldAlert}
        accent="warning"
        valueClassName="text-warning"
        status={statusFor(openRisks)}
        dense
      />
      <DashboardKpiCard
        label="Pending Documents"
        value={pendingDocuments}
        icon={FileText}
        accent="warning"
        valueClassName="text-warning"
        status={statusFor(pendingDocuments)}
        dense
      />
      <DashboardKpiCard
        label="Open Issues"
        value={openIssues}
        icon={MessageSquareWarning}
        accent="warning"
        valueClassName="text-warning"
        status={statusFor(openIssues)}
        dense
      />
    </div>
  );
}
