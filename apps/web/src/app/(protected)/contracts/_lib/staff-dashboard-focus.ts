// ---------------------------------------------------------------------------
// CM-47 — "Today's Work / Next Task" focus logic and the 4 focused summary
// counts for the Contract Staff Dashboard. Pure, dependency-free so it can
// be unit tested directly, matching the pattern used by
// ./contract-dashboard-focus.ts (the separate, untouched Manager Dashboard
// equivalent — Contract Staff and Contract Manager dashboards deliberately
// never share this kind of business logic, even where the shape looks
// similar, so a change to one can never silently affect the other).
//
// Every count/selection here is derived only from `StaffTaskRow[]` — the
// backend's own, already-computed, unfiltered list of the actor's assigned
// tasks (contract-dashboard.service.ts's buildStaffTaskRows) — never a
// separately re-derived overdue/status rule and never invented data.
// ---------------------------------------------------------------------------

import type { StaffTaskRow } from '@/lib/contracts-api';

export interface StaffFocusedCounts {
  dueToday: number;
  overdue: number;
  inProgress: number;
  submittedWaitingReview: number;
}

const WAITING_REVIEW_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];
const HIGH_PRIORITIES = ['HIGH', 'CRITICAL'];

/** The 4 focused summary card counts. Due Today and Submitted/Waiting Review are computed here since the dashboard summary endpoint doesn't carry them; Overdue and In Progress are also derivable this way for consistency, matching (not duplicating a different definition of) the backend's own StaffDashboardSummary.myOverdueTasks/myInProgressTasks. */
export function computeStaffFocusedCounts(tasks: StaffTaskRow[], todayIso: string): StaffFocusedCounts {
  return {
    dueToday: tasks.filter((t) => t.dueDate === todayIso && t.status !== 'COMPLETED').length,
    overdue: tasks.filter((t) => t.isOverdue).length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    submittedWaitingReview: tasks.filter((t) => WAITING_REVIEW_STATUSES.includes(t.status)).length,
  };
}

/**
 * Picks the single most urgent task for the "Today's Work / Next Task"
 * panel, in the spec's stated priority order: overdue, due today,
 * high-priority not-started, in-progress, then earliest due date. Tasks
 * arrive already sorted by due date ascending (buildStaffTaskRows on the
 * backend), so the first match in the overdue/due-today/high-priority/
 * in-progress buckets is also the earliest-due task within that bucket;
 * the final "earliest due date" fallback re-sorts explicitly so this
 * function's own correctness never depends on the caller's ordering.
 *
 * CM-71H.5 — a locked guided erection step (guidedStepLocked === true,
 * computed in dashboard/page.tsx from the same erection-step-lock.ts rule
 * the guided pages themselves enforce) is NEVER a candidate here, at any
 * priority tier — it isn't actionable yet regardless of how overdue/urgent
 * its underlying generic task row looks, so surfacing it as "Today's Work"
 * would send the actor to a screen that just tells them to come back
 * later. See hasOnlyLockedOpenTasks() for the caller-side "you have open
 * work, but none of it is actionable right now" case this creates.
 */
export function pickNextTask(tasks: StaffTaskRow[], todayIso: string): StaffTaskRow | undefined {
  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.guidedStepLocked !== true);
  if (openTasks.length === 0) return undefined;

  const overdue = openTasks.filter((t) => t.isOverdue);
  if (overdue.length > 0) return overdue[0];

  const dueToday = openTasks.filter((t) => t.dueDate === todayIso);
  if (dueToday.length > 0) return dueToday[0];

  const highPriorityNotStarted = openTasks.filter((t) => HIGH_PRIORITIES.includes(t.priority) && t.status === 'NOT_STARTED');
  if (highPriorityNotStarted.length > 0) return highPriorityNotStarted[0];

  const inProgress = openTasks.filter((t) => t.status === 'IN_PROGRESS');
  if (inProgress.length > 0) return inProgress[0];

  const withDueDate = openTasks
    .filter((t) => t.dueDate !== null)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  if (withDueDate.length > 0) return withDueDate[0];

  return openTasks[0];
}

/**
 * CM-71H.5 — true only when the actor has real open (non-COMPLETED) work,
 * but every single one of it is a locked guided erection step — the
 * distinct "nothing to do RIGHT NOW, but not because your queue is empty"
 * case pickNextTask()'s plain `undefined` return can't tell apart from
 * "you have zero assigned work." Drives StaffTodaysWorkPanel's 3rd,
 * dedicated empty-state message.
 */
export function hasOnlyLockedOpenTasks(tasks: StaffTaskRow[]): boolean {
  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED');
  return openTasks.length > 0 && openTasks.every((t) => t.guidedStepLocked === true);
}
