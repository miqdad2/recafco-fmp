import { FileText, CheckCircle2, Clock, CalendarClock, AlertTriangle } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ContractDocumentObligationSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractDocumentObligationSummary;
}

function percentOf(count: number, total: number): string {
  if (total === 0) return '0% of total';
  return `${((count / total) * 100).toFixed(1)}% of total`;
}

/**
 * CM-63 — five KPI cards for the Contract Detail Documents & Obligations
 * tab, matching the approved design. All values come from
 * ContractDocumentObligationSummary (server-computed from real item
 * records; 0 for a contract with no items — see
 * contract-document-obligations.service.ts). Submitted/Pending are raw
 * status counts; Expiring Soon/Expired-Overdue are derived from status +
 * Expiry Date (CM-70E) without ever mutating the stored status column —
 * an item can honestly appear in both a raw count and a derived count at
 * once (e.g. still "Pending" by status but already overdue by date).
 * Divide-by-zero safe: percentOf() returns "0% of total" for a contract
 * with zero items, never NaN/Infinity.
 * CM-63B — each card's own value text (not just its icon circle) is now
 * color-coded via DashboardKpiCard's `valueClassName` prop: Total Items
 * blue, Submitted green, Pending amber, Expiring Soon purple, Expired /
 * Overdue red — same accent family already used for each card's icon,
 * carried onto the number itself for stronger visual hierarchy, matching
 * the CM-59B/60B/61B/62B precedent. No value or calculation changed.
 */
export function ContractDocumentKpiStrip({ summary }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <DashboardKpiCard label="Total Items" value={summary.totalItems} icon={FileText} accent="info" valueClassName="text-info" subtext="All documents & obligations" status="ok" />
      <DashboardKpiCard label="Submitted" value={summary.submitted} icon={CheckCircle2} accent="success" valueClassName="text-success" subtext={percentOf(summary.submitted, summary.totalItems)} status="ok" />
      <DashboardKpiCard label="Pending" value={summary.pending} icon={Clock} accent="warning" valueClassName="text-warning" subtext={percentOf(summary.pending, summary.totalItems)} status="ok" />
      <DashboardKpiCard label="Expiring Soon" value={summary.expiringSoon} icon={CalendarClock} accent="accent" valueClassName="text-accent" subtext="Within 30 days" status="ok" />
      <DashboardKpiCard label="Expired / Overdue" value={summary.expiredOverdue} icon={AlertTriangle} accent="error" valueClassName="text-error" subtext="Require immediate action" status="ok" />
    </div>
  );
}
