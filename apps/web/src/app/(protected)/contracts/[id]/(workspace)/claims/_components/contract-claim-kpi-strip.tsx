import { ClipboardList, FileInput, ShieldCheck, Wallet, CalendarClock, CalendarCheck2, AlertTriangle } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ContractClaimSummary } from '@/lib/contracts-api';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';

interface Props {
  summary: ContractClaimSummary;
  totalClaims: number;
}

/**
 * CM-61 — seven KPI cards for the Contract Detail Claims tab, matching the
 * approved design. All values come from ContractClaimSummary
 * (server-computed from real claim records; 0 for a contract with no claims
 * — see contract-claims.service.ts). Outstanding Value already excludes
 * REJECTED/CANCELLED claims (a CM-61 fix to computeClaimSummary — see that
 * function's own comment); Overdue Actions reuses the same overdueClaims
 * count already computed for the module-level Claim Log (its own status
 * exclusions are a superset of "not closed/cancelled", so it's at least as
 * correct as this unit's own narrower wording).
 * CM-61B — each card's own value text (not just its icon circle) is now
 * color-coded via DashboardKpiCard's `valueClassName` prop (CM-60B):
 * Open Claims/Submitted Value blue, Approved Value/EOT Approved green,
 * Outstanding Value orange, EOT Claimed purple, Overdue Actions red — same
 * accent family already used for each card's icon, carried onto the number
 * itself for stronger visual hierarchy. No value or calculation changed.
 */
export function ContractClaimKpiStrip({ summary, totalClaims }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      <DashboardKpiCard label="Open Claims" value={summary.openClaims} icon={ClipboardList} accent="info" valueClassName="text-info" subtext={`of ${totalClaims} Total`} status="ok" />
      <DashboardKpiCard label="Submitted Value" value={formatContractValue(summary.totalSubmittedValue, undefined)} icon={FileInput} accent="info" valueClassName="text-info" subtext="KWD" status="ok" />
      <DashboardKpiCard label="Approved Value" value={formatContractValue(summary.totalApprovedValue, undefined)} icon={ShieldCheck} accent="success" valueClassName="text-success" subtext="KWD" status="ok" />
      <DashboardKpiCard label="Outstanding Value" value={formatContractValue(summary.totalOutstandingValue, undefined)} icon={Wallet} accent="warning" valueClassName="text-warning" subtext="KWD" status="ok" />
      <DashboardKpiCard label="EOT Claimed (Days)" value={summary.totalEotClaimedDays} icon={CalendarClock} accent="accent" valueClassName="text-accent" status="ok" />
      <DashboardKpiCard label="EOT Approved (Days)" value={summary.totalEotApprovedDays} icon={CalendarCheck2} accent="success" valueClassName="text-success" status="ok" />
      <DashboardKpiCard label="Overdue Actions" value={summary.overdueClaims} icon={AlertTriangle} accent="error" valueClassName="text-error" subtext="Require attention" status="ok" />
    </div>
  );
}
