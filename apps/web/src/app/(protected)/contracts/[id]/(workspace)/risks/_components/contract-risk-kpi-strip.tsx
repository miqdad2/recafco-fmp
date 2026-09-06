import { ShieldAlert, AlertTriangle, FolderOpen, ShieldCheck, Gauge, Clock4 } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ContractRiskSummary } from '@/lib/contracts-api';
import { RISK_LEVEL_LABELS } from '../../../../_lib/contract-risk-helpers';

interface Props {
  summary: ContractRiskSummary;
}

/**
 * CM-62 — six KPI cards for the Contract Detail Risk Assessment tab,
 * matching the approved design. All values come from ContractRiskSummary
 * (server-computed from real risk records; 0 for a contract with no risks).
 * Average Residual Risk uses the documented Low=1/Medium=2/High=3/Critical=4
 * mapping (see contract-risks.service.ts computeRiskSummary) averaged only
 * over risks that actually have a manually-set residualRisk — "—" (not a
 * fabricated label) when none do.
 * CM-62B — each card's own value text (not just its icon circle) is now
 * color-coded via DashboardKpiCard's `valueClassName` prop: Total Risks
 * blue, High/Critical Risks red, Open Risks amber, Mitigated Risks green,
 * Average Residual Risk purple, Risks Due Soon teal — same accent family
 * already used for each card's icon, carried onto the number itself for
 * stronger visual hierarchy, matching the CM-59B/60B/61B precedent. No
 * value or calculation changed.
 */
export function ContractRiskKpiStrip({ summary }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <DashboardKpiCard label="Total Risks" value={summary.totalRisks} icon={ShieldAlert} accent="info" valueClassName="text-info" subtext="All identified risks" status="ok" />
      <DashboardKpiCard label="High / Critical Risks" value={summary.highCriticalRisks} icon={AlertTriangle} accent="error" valueClassName="text-error" subtext="Require attention" status="ok" />
      <DashboardKpiCard label="Open Risks" value={summary.openRisks} icon={FolderOpen} accent="warning" valueClassName="text-warning" subtext="Not yet mitigated" status="ok" />
      <DashboardKpiCard label="Mitigated Risks" value={summary.mitigatedRisks} icon={ShieldCheck} accent="success" valueClassName="text-success" subtext="Risk reduced" status="ok" />
      <DashboardKpiCard
        label="Average Residual Risk"
        value={summary.averageResidualRisk ? RISK_LEVEL_LABELS[summary.averageResidualRisk] : '—'}
        icon={Gauge}
        accent="accent"
        valueClassName="text-accent"
        subtext="Low=1 · Medium=2 · High=3 · Critical=4"
        status="ok"
      />
      <DashboardKpiCard label="Risks Due Soon" value={summary.risksDueSoon} icon={Clock4} accent="teal" valueClassName="text-teal" subtext="Within 30 days" status="ok" />
    </div>
  );
}
