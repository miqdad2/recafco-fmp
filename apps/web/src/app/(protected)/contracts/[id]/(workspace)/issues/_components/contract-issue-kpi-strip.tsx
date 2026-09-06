import { ListChecks, FolderOpen, Loader2, MessageSquareWarning, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ContractIssueSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractIssueSummary;
}

/**
 * CM-65 — six KPI cards for the Contract Detail Issue Log tab, matching
 * the approved design. All values come from ContractIssueSummary
 * (server-computed from real issue records; 0 for a contract with no
 * issues — see contract-issues.service.ts computeIssueSummary()). Closed
 * issues are deliberately NOT a 7th card here (kept the layout to the
 * approved 6) — Closed stays reachable via the Status filter and the
 * table's own status badge, per this unit's own "include Closed only if
 * layout stays clean" instruction.
 */
export function ContractIssueKpiStrip({ summary }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <DashboardKpiCard label="Total Issues" value={summary.totalIssues} icon={ListChecks} accent="info" valueClassName="text-info" subtext="All contract issues" status="ok" />
      <DashboardKpiCard label="Open Issues" value={summary.openIssues} icon={FolderOpen} accent="warning" valueClassName="text-warning" subtext="Need action" status="ok" />
      <DashboardKpiCard label="In Progress" value={summary.inProgressIssues} icon={Loader2} accent="teal" valueClassName="text-teal" subtext="Being handled" status="ok" />
      <DashboardKpiCard label="Waiting" value={summary.waitingResponseIssues} icon={MessageSquareWarning} accent="team-production" valueClassName="text-team-production" subtext="Waiting response" status="ok" />
      <DashboardKpiCard label="Resolved" value={summary.resolvedIssues} icon={CheckCircle2} accent="success" valueClassName="text-success" subtext="Resolved issues" status="ok" />
      <DashboardKpiCard label="Overdue Issues" value={summary.overdueIssues} icon={AlertTriangle} accent="error" valueClassName="text-error" subtext="Require attention" status="ok" />
    </div>
  );
}
