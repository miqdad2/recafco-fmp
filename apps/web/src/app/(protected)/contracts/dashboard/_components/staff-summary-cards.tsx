import { CalendarClock, AlertTriangle, Loader2, ClipboardCheck } from 'lucide-react';
import { MetricCard, type MetricStatus } from '../../../_components/metric-card';
import type { StaffDashboardSummary } from '@/lib/contracts-api';
import type { StaffFocusedCounts } from '../../_lib/staff-dashboard-focus';

interface Props {
  summary: StaffDashboardSummary | undefined;
  focused: StaffFocusedCounts | undefined;
  status: MetricStatus;
}

/**
 * CM-47 — replaces the old 6-card "mini manager" summary (My Open Tasks,
 * My In Progress Tasks, My Overdue Tasks, Due This Week, Completed Tasks,
 * My Active Contracts) with the 4 cards Contract Staff actually need to
 * answer "what's urgent right now": Due Today, Overdue, In Progress,
 * Submitted / Waiting Review. Due This Week and (all-time) Completed Tasks
 * move to a small secondary stat strip below the cards rather than
 * disappearing — still real data, just no longer competing for primary
 * attention. My Active Contracts is dropped entirely per the spec ("staff
 * dashboard should not focus on contracts") rather than relocated, since
 * it isn't one of the things staff need to act on day to day.
 *
 * `focused` (Due Today / Submitted-Waiting-Review counts) is computed
 * client-side in page.tsx from the already-fetched, unfiltered
 * `assignedTasks` list (see staff-dashboard-focus.ts) — the dashboard
 * summary endpoint itself was never touched for these two.
 *
 * CM-48 — fixed at a 2-column grid (was responsive up to 4-across) since
 * this now lives in the single-window dashboard's narrower right column,
 * where a 2x2 block of mini-stat cards is more compact than a single wide row.
 */
export function StaffSummaryCards({ summary, focused, status }: Props): React.JSX.Element {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Due Today"
          value={focused?.dueToday}
          icon={CalendarClock}
          iconColor="text-warning"
          href="/contracts/workflow?mode=my-tasks"
          status={status}
          dense
        />
        <MetricCard
          label="Overdue"
          value={summary?.myOverdueTasks}
          icon={AlertTriangle}
          iconColor="text-error"
          href="/contracts/workflow?mode=overdue"
          status={status}
          dense
        />
        <MetricCard
          label="In Progress"
          value={summary?.myInProgressTasks}
          icon={Loader2}
          iconColor="text-info"
          href="/contracts/workflow?mode=my-tasks"
          status={status}
          dense
        />
        <MetricCard
          label="Submitted / Waiting Review"
          value={focused?.submittedWaitingReview}
          icon={ClipboardCheck}
          iconColor="text-accent"
          href="/contracts/workflow?mode=my-tasks"
          status={status}
          dense
        />
      </div>
      <SecondaryMetricsStrip summary={summary} />
    </div>
  );
}

function SecondaryMetricsStrip({ summary }: { summary: StaffDashboardSummary | undefined }): React.JSX.Element {
  const v = (n: number | undefined): string => (n === undefined ? '—' : String(n));
  const metrics: { label: string; value: string }[] = [
    { label: 'Due This Week', value: v(summary?.dueThisWeek) },
    { label: 'Completed', value: v(summary?.completedTasks) },
    { label: 'Active Contracts', value: v(summary?.myActiveContracts) },
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
