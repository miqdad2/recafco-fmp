import { FileText, CheckCircle2, Clock, XCircle, TrendingUp, Wallet } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ContractVariationSummary } from '@/lib/contracts-api';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';

interface Props {
  summary: ContractVariationSummary;
  computedCurrentValue: string | null;
}

/**
 * CM-60 — six KPI cards for the Contract Detail Variations / Change Orders
 * tab, matching the approved design. All values come from
 * ContractVariationSummary (server-computed from real variation records; 0
 * for a contract with no variations — see contract-variations.service.ts).
 * Current Contract Value here is computedCurrentValue (Original + Approved),
 * NOT Contract.contractValue (which stays BOQ-derived and untouched by this
 * unit) — "—" when the contract has no originalContractValue, never a
 * fabricated number.
 * CM-60B — each money card's own value text (not just its icon circle) is
 * now color-coded via DashboardKpiCard's new `valueClassName` prop: Approved
 * green, Pending amber, Rejected/Cancelled red, Net Impact accent/purple,
 * Current Contract Value teal — same accent family already used for each
 * card's icon, just carried onto the number itself for stronger visual
 * hierarchy. Total Variations (a plain count, not a money value) is left at
 * the default text-primary color. No value or calculation changed.
 */
export function ContractVariationKpiStrip({ summary, computedCurrentValue }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <DashboardKpiCard label="Total Variations" value={summary.totalVariations} icon={FileText} accent="info" subtext="All time" status="ok" />
      <DashboardKpiCard label="Approved Variations Value" value={formatContractValue(summary.approvedValue, undefined)} icon={CheckCircle2} accent="success" valueClassName="text-success" subtext="KWD" status="ok" />
      <DashboardKpiCard label="Pending Variations Value" value={formatContractValue(summary.pendingValue, undefined)} icon={Clock} accent="warning" valueClassName="text-warning" subtext="KWD" status="ok" />
      <DashboardKpiCard label="Rejected / Cancelled Value" value={formatContractValue(summary.rejectedCancelledValue, undefined)} icon={XCircle} accent="error" valueClassName="text-error" subtext="KWD" status="ok" />
      <DashboardKpiCard label="Net Variation Impact" value={formatContractValue(summary.netVariationImpact, undefined)} icon={TrendingUp} accent="accent" valueClassName="text-accent" subtext="Approved + Pending" status="ok" />
      <DashboardKpiCard label="Current Contract Value" value={computedCurrentValue ? formatContractValue(computedCurrentValue, undefined) : '—'} icon={Wallet} accent="teal" valueClassName="text-teal" subtext="Original + Approved" status="ok" />
    </div>
  );
}
