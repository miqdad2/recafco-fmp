import { AlertTriangle, MessageSquareWarning, Receipt, ClipboardCheck, ListChecks } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { ManagerDashboardSummary } from '@/lib/contracts-api';

interface Props {
  summary: ManagerDashboardSummary | undefined;
  /** Length of the (backend-capped-at-30) attentionItems list — the simplest available "Needs Action" count, per CM-39's own definition. See ui-registry.md for the cap caveat. */
  needsAction: number | undefined;
  status: MetricStatus;
}

/** CM-39 — reduced from CM-37's 9 primary cards to 5. The remaining 5 metrics
 * (Active/Draft/Awaiting Activation/Outstanding Payments/Due This Week) move
 * to a compact strip below — see SecondaryMetricsStrip.
 * CM-39C — renamed "Needs Action" to "Manager Actions", added short helper
 * copy + an in-page anchor link to the Priority Actions section below, and
 * switched to MetricCard's `dense` variant for a slightly shorter card. */
export function ManagerSummaryCards({ summary, needsAction, status }: Props): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      <MetricCard
        label="Manager Actions"
        value={needsAction}
        icon={ListChecks}
        iconColor="text-accent"
        status={status}
        href="#priority-actions"
        source="Items needing your review"
        dense
      />
      <MetricCard
        label="Overdue Tasks"
        value={summary?.overdueWorkflowTasks}
        icon={AlertTriangle}
        iconColor="text-danger"
        href="/contracts/workflow?overdueOnly=true"
        status={status}
        source="Workflow tasks past due"
        dense
      />
      <MetricCard
        label="Open Issues"
        value={summary?.openIssues}
        icon={MessageSquareWarning}
        iconColor="text-warning"
        href="/contracts/issues"
        status={status}
        source="Unresolved contract issues"
        dense
      />
      <MetricCard
        label="Open Claims"
        value={summary?.openClaims}
        icon={Receipt}
        iconColor="text-warning"
        href="/contracts/claims"
        status={status}
        source="Claims awaiting resolution"
        dense
      />
      <MetricCard
        label="Pending Closeout"
        value={summary?.pendingCloseoutRequests}
        icon={ClipboardCheck}
        iconColor="text-info"
        href="/contracts/closeouts?pendingOnly=true"
        status={status}
        source="Requests awaiting your review"
        dense
      />
    </div>
  );
}

/** CM-39C — restyled from a single muted text line into a softer row of
 * labeled chips so the secondary metrics read as distinct values rather
 * than one dense sentence. Same 5 figures, no data change. */
export function SecondaryMetricsStrip({ summary }: { summary: ManagerDashboardSummary | undefined }): React.JSX.Element {
  const v = (n: number | undefined): string => (n === undefined ? '—' : String(n));
  const metrics: { label: string; value: string }[] = [
    { label: 'Active', value: v(summary?.activeContracts) },
    { label: 'Draft', value: v(summary?.draftContracts) },
    { label: 'Awaiting Activation', value: v(summary?.contractsAwaitingActivation) },
    { label: 'Outstanding Payments', value: v(summary?.outstandingPayments) },
    { label: 'Due This Week', value: v(summary?.dueThisWeek) },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5 rounded-md bg-surface-secondary/60 px-3 py-2">
      {metrics.map((m, i) => (
        <span key={m.label} className="inline-flex items-center gap-1 text-xs">
          {i > 0 && <span className="text-border-strong mr-1" aria-hidden="true">·</span>}
          <span className="text-text-muted">{m.label}:</span>
          <span className="font-medium text-text-secondary">{m.value}</span>
        </span>
      ))}
    </div>
  );
}
