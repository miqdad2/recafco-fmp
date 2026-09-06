import { History, TrendingUp, Paperclip, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ActivitySummary } from '../../../../_lib/contract-activity-helpers';

interface Props {
  summary: ActivitySummary;
}

/**
 * CM-66 — five KPI cards for the Activity / Audit History tab: real counts
 * only (see computeActivitySummary()), all derived from the same real
 * activity list the table itself shows. "Review / Approval Actions" counts
 * the genuinely identifiable closeout review/approval/rejection events
 * (never a fake "Workflow Actions" fallback, since this app has no logged
 * workflow-task events yet — see contract-activity-helpers.ts's own
 * isReviewApprovalEvent()).
 */
export function ContractActivityKpiStrip({ summary }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <DashboardKpiCard label="Total Activities" value={summary.totalActivities} icon={History} accent="info" valueClassName="text-info" subtext="All time" status="ok" />
      <DashboardKpiCard label="Updates This Month" value={summary.updatesThisMonth} icon={TrendingUp} accent="teal" valueClassName="text-teal" subtext="Current month" status="ok" />
      <DashboardKpiCard label="Documents Uploaded" value={summary.documentsUploaded} icon={Paperclip} accent="team-production" valueClassName="text-team-production" subtext="All time" status="ok" />
      <DashboardKpiCard label="Status Changes" value={summary.statusChanges} icon={ArrowRightLeft} accent="warning" valueClassName="text-warning" subtext="All time" status="ok" />
      <DashboardKpiCard label="Review / Approval Actions" value={summary.reviewApprovalActions} icon={ShieldCheck} accent="success" valueClassName="text-success" subtext="All time" status="ok" />
    </div>
  );
}
