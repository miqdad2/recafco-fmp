import type { ContractDashboardData, ScheduleItem } from '@/lib/contracts-api';
import type { MetricStatus } from '../../../_components/metric-card';
import { DashboardToolbar } from './dashboard-toolbar';
import { StaffSummaryCards } from './staff-summary-cards';
import { StaffTaskTable } from './staff-task-table';
import { StaffRecentUpdates } from './staff-recent-updates';
import { StaffTodaysWorkPanel } from './staff-todays-work-panel';
import { UpcomingScheduleList } from './upcoming-schedule-list';
import { computeStaffFocusedCounts, pickNextTask, hasOnlyLockedOpenTasks } from '../../_lib/staff-dashboard-focus';
import { isGuidedErectionWorkflowTask } from '../../_lib/guided-erection-workflow-route';

interface Props {
  data: ContractDashboardData;
  status: MetricStatus;
}

const MY_TASKS_HREF = '/contracts/workflow?mode=my-tasks';

/**
 * CM-48/CM-48B — the Contract Staff Dashboard's single-window layout,
 * returned as a completely separate tree from page.tsx's shared
 * MANAGER/legacy return path (see the `if (dashboardType === 'STAFF' ...)`
 * early return there). Root is `h-full flex flex-col`, the same pattern
 * CM-46C established for the focused task screen: app-shell.tsx's `<main
 * class="flex-1 overflow-auto">` already gives a `h-full` child a
 * definite, viewport-derived height through ordinary flexbox, so no
 * calc(100vh-Npx) guess is needed. The header is `shrink-0`, Today's Work
 * is a `shrink-0` full-width card, and the two-column grid below it is the
 * single `flex-1 min-h-0 overflow-y-auto` region — the only place that
 * scrolls if content (mainly a long assigned-task or updates list)
 * exceeds the available height.
 *
 * CM-48B rebalanced CM-48's column split after audit found the left
 * column went empty below My Assigned Tasks while the right column
 * (Summary + Schedule + Updates) felt crowded: Today's Work moved out of
 * the left column to its own full-width row above the grid, My Recent
 * Task Updates moved from the right column into the left column (under My
 * Assigned Tasks), and My Work Summary shrank to fit a narrower right
 * column above Upcoming Schedule. No data, field, or action changed.
 *
 * Today's Work / focused summary counts / next-task pick are all derived
 * here from the same, already-fetched, unfiltered `assignedTasks` list the
 * task list itself renders (see staff-dashboard-focus.ts) — no new
 * endpoint, no re-derived overdue rule, carried over unchanged from CM-47.
 */
export function StaffDashboardView({ data, status }: Props): React.JSX.Element {
  const todayIso = new Date().toISOString().slice(0, 10);
  const assignedTasks = data.staff?.assignedTasks ?? [];
  const focusedCounts = computeStaffFocusedCounts(assignedTasks, todayIso);
  const nextTask = pickNextTask(assignedTasks, todayIso);
  const hasOnlyLockedWork = hasOnlyLockedOpenTasks(assignedTasks);

  // CM-71H.5 — "avoid implying all 6 locked future steps are active work":
  // the least-risky of this unit's own 2 named options — renaming the
  // section, never filtering rows out of it (filtering would hide real
  // assigned data other parts of this screen, e.g. My Work Summary's own
  // counts, still count) — and only when EVERY visible task really is a
  // guided erection step, so a staff member with a genuine mix of erection
  // + Technical/Production/QS work never gets a misleadingly erection-only
  // heading for their real, mixed queue.
  const isAllErectionSteps = assignedTasks.length > 0 && assignedTasks.every((t) => isGuidedErectionWorkflowTask(t));
  const assignedTasksHeading = isAllErectionSteps ? 'My Erection Workflow Steps' : 'My Assigned Tasks';

  // Staff's Upcoming Schedule shows only their own assigned workflow tasks
  // (never contract-level payment/issue/claim/closeout dates that happen to
  // pass the schedule endpoint's responsibleUserId filter) and routes each
  // item at the staff task screen, not the manager workspace staff can no
  // longer reach. Unchanged from CM-47.
  const staffUpcomingSchedule: ScheduleItem[] = (data.staff?.upcomingSchedule ?? [])
    .filter((item) => item.sourceType === 'WORKFLOW_TASK')
    .map((item) => ({ ...item, actionUrl: `/contracts/workflow?mode=my-tasks&taskId=${item.sourceId}` }));

  return (
    <div className="h-full min-h-0 flex flex-col px-4 lg:px-6 py-3 max-w-[1900px] mx-auto w-full gap-2.5">
      {/* Header row — compact: title/subtitle, date/scope chips + View My Tasks all close together. Breadcrumb now renders at top-header level (CM-66E). */}
      <div className="shrink-0 space-y-1.5">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">My Contract Work Dashboard</h1>
          <p className="mt-0.5 text-sm text-text-secondary max-w-2xl">
            Your assigned workflow tasks, due dates, comments and document updates.
          </p>
        </div>
        <DashboardToolbar scope={data.scope} dashboardType="STAFF" canCreate={false} canClose={false} />
      </div>

      {/* Today's Work — full-width compact priority card, above the two-column grid */}
      <StaffTodaysWorkPanel task={nextTask} hasOnlyLockedWork={hasOnlyLockedWork} />

      {/* Main dashboard grid — the only internally-scrolling region if content overflows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3 items-start">
          {/* Left/main column — My Assigned Tasks, My Recent Task Updates */}
          <div className="flex flex-col gap-3 min-w-0">
            <section aria-labelledby="my-tasks-heading" className="rounded-lg border border-border bg-surface p-3">
              <h2 id="my-tasks-heading" className="text-sm font-semibold text-text-primary mb-2">{assignedTasksHeading}</h2>
              <StaffTaskTable tasks={assignedTasks} todayIso={todayIso} limit={5} />
            </section>

            <section aria-labelledby="recent-updates-heading" className="rounded-lg border border-border bg-surface p-3">
              <h2 id="recent-updates-heading" className="text-sm font-semibold text-text-primary mb-2">My Recent Task Updates</h2>
              <StaffRecentUpdates updates={data.staff?.recentUpdates ?? []} limit={3} />
            </section>
          </div>

          {/* Right/side column — My Work Summary, My Upcoming Schedule */}
          <div className="flex flex-col gap-3 min-w-0">
            <section aria-labelledby="staff-summary-heading">
              <h2 id="staff-summary-heading" className="text-sm font-semibold text-text-primary mb-2">My Work Summary</h2>
              <StaffSummaryCards summary={data.staff?.summary} focused={focusedCounts} status={status} />
            </section>

            <section aria-labelledby="my-schedule-heading">
              <h2 id="my-schedule-heading" className="text-sm font-semibold text-text-primary mb-2">My Upcoming Schedule</h2>
              <UpcomingScheduleList
                items={staffUpcomingSchedule}
                limit={3}
                moreHref={MY_TASKS_HREF}
                moreLabel="View My Tasks"
                emptyTitle="No upcoming assigned tasks."
                emptyDescription="Your assigned workflow due dates will appear here as they come up."
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
