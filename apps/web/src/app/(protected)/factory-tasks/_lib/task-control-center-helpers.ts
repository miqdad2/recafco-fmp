// ---------------------------------------------------------------------------
// FMP-UI-20 — Pure, presentation-agnostic helpers for the Task Control
// Center (the redesigned `factory-tasks/executive/page.tsx`). Dependency-free
// so they can be unit tested directly, matching contract-erection-dashboard-
// helpers.ts's own shape/style. No new data — every function here operates
// on the same FactoryTask fields already returned by the existing API.
// ---------------------------------------------------------------------------

import type { FactoryTask, TaskStatus } from '@/lib/factory-tasks-api';

/** Same non-terminal/non-draft population the backend's own OVERDUE_STATUSES/ACTIVE_STATUSES use. */
const OVERDUE_ELIGIBLE_STATUSES: TaskStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'];

/** Mirrors the existing isOverdue() already used by factory-tasks/page.tsx and factory-tasks/my/page.tsx — kept here too so the Control Center's own list/cards use the exact same real rule. */
export function isTaskRowOverdue(dueAt: string | null, status: TaskStatus): boolean {
  if (!dueAt) return false;
  if (!OVERDUE_ELIGIBLE_STATUSES.includes(status)) return false;
  return new Date(dueAt) < new Date();
}

/** FMP-TASK-01 — "Pending" = every real status that is not COMPLETED/CLOSED/CANCELLED. No new enum values. */
export const PENDING_STATUSES: TaskStatus[] = ['DRAFT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED'];

type UrgencyRow = Pick<FactoryTask, 'priority' | 'dueAt' | 'status'>;

export function isTaskDueToday(dueAt: string | null, status: TaskStatus): boolean {
  if (!dueAt || !OVERDUE_ELIGIBLE_STATUSES.includes(status)) return false;
  const d = new Date(dueAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** FMP-TASK-01 — Urgent tab rule: an active task that is HIGH/URGENT priority, overdue, or due today. */
export function isTaskUrgent(task: UrgencyRow): boolean {
  if (!OVERDUE_ELIGIBLE_STATUSES.includes(task.status)) return false;
  return task.priority === 'HIGH' || task.priority === 'URGENT' || isTaskRowOverdue(task.dueAt, task.status) || isTaskDueToday(task.dueAt, task.status);
}

/** FMP-TASK-01 — Completed tab order: latest completion first, falling back to the last update. */
export function sortCompletedTasks<T extends Pick<FactoryTask, 'completedAt' | 'updatedAt'>>(tasks: T[]): T[] {
  const stamp = (t: T): number => new Date(t.completedAt ?? t.updatedAt).getTime();
  return [...tasks].sort((a, b) => stamp(b) - stamp(a));
}

/** FMP-TASK-01 — "Assigned By" text; the creator is the person who gave the task. */
export function getAssignedByLabel(task: { createdByUser?: { displayName: string } | null }): string {
  return task.createdByUser?.displayName ?? 'Unknown';
}

export type TaskControlCenterTabKey = 'all' | 'my' | 'assigned' | 'urgent' | 'pending' | 'completed';

export interface TaskControlCenterTab {
  key: TaskControlCenterTabKey;
  label: string;
  /** Where this tab's own "View all" link points — the existing dedicated page/query for that exact same data. */
  viewAllHref: string;
  emptyMessage: string;
  /** When set, this tab is only visible to a viewer who holds this permission — never a new one, always an existing task permission. */
  requiresPermission?: string;
}

/**
 * FMP-TASK-01 — the 6 tabs in the required order. Every tab is visible to
 * any `tasks.read` viewer: the list endpoint is itself `tasks.read` and
 * scopes results server-side, so "All Tasks" means "all tasks this viewer
 * is allowed to see" (previously hidden behind tasks.manage).
 */
export const TASK_CONTROL_CENTER_TABS: TaskControlCenterTab[] = [
  { key: 'all', label: 'All Tasks', viewAllHref: '/factory-tasks', emptyMessage: 'No tasks found.' },
  { key: 'my', label: 'My Tasks', viewAllHref: '/factory-tasks?tab=my', emptyMessage: 'No tasks assigned to you.' },
  { key: 'assigned', label: 'Tasks I Assigned', viewAllHref: '/factory-tasks?tab=assigned', emptyMessage: 'No tasks assigned by you.' },
  { key: 'urgent', label: 'Urgent', viewAllHref: '/factory-tasks?tab=urgent', emptyMessage: 'No urgent tasks right now.' },
  { key: 'pending', label: 'Pending', viewAllHref: '/factory-tasks?tab=pending', emptyMessage: 'No pending tasks.' },
  { key: 'completed', label: 'Completed', viewAllHref: '/factory-tasks?tab=completed', emptyMessage: 'No completed tasks found.' },
];

/** Tabs the current viewer is actually allowed to see, in the same fixed order — "do not show tabs the user cannot access." */
export function getVisibleTaskControlCenterTabs(permissions: string[]): TaskControlCenterTab[] {
  return TASK_CONTROL_CENTER_TABS.filter((t) => !t.requiresPermission || permissions.includes(t.requiresPermission));
}

export function isValidTaskControlCenterTab(value: string | undefined, permissions: string[]): value is TaskControlCenterTabKey {
  return getVisibleTaskControlCenterTabs(permissions).some((t) => t.key === value);
}

type ActionRow = Pick<FactoryTask, 'status' | 'createdByUserId' | 'assignedToUserId'>;

/**
 * FMP-UI-20E — "Next Action" column text, using the brief's own required
 * vocabulary ("Assign Task" / "Start Task" / "Complete Task" / "Close
 * Task" / "No action needed") for the common cases, extended with the same
 * "<Verb> Task" phrasing for the other real lifecycle states (Reassign/
 * Unblock/Reopen) so the column never mixes styles. Never a fabricated
 * action — always the SAME priority order
 * factory-tasks/_components/task-transitions.tsx already builds its real
 * buttons in (that component is the actual place these actions execute;
 * this is only the list's own preview text). "No action needed" is the
 * honest fallback once no state-changing action applies for this viewer
 * (e.g. a plain viewer with no tasks.* permission beyond tasks.read, or a
 * task fully wrapped up with nothing left to do).
 */
export function computeTaskNextActionText(task: ActionRow, currentUserId: string, permissions: string[]): string {
  const has = (p: string): boolean => permissions.includes(p);
  const isAssignee = task.assignedToUserId === currentUserId;
  const isCreator = task.createdByUserId === currentUserId;

  switch (task.status) {
    case 'DRAFT':
      // FMP-UI-20G — "Open Task" renamed to "Start Work" to match the
      // real button's own new label (task-transitions.tsx) — the phrase
      // now names the actual lifecycle move (DRAFT → OPEN) instead of
      // reading as "open the page you're already viewing."
      return isCreator || has('tasks.manage') ? 'Start Work' : 'No action needed';
    case 'OPEN':
      if (has('tasks.assign')) return 'Assign Task';
      return isCreator || has('tasks.manage') ? 'Cancel Task' : 'No action needed';
    case 'ASSIGNED':
      if (isAssignee || has('tasks.start')) return 'Start Task';
      if (has('tasks.assign')) return 'Reassign Task';
      return 'No action needed';
    case 'IN_PROGRESS':
      if (isAssignee || has('tasks.complete')) return 'Complete Task';
      if (isAssignee || has('tasks.block')) return 'Mark Blocked';
      if (has('tasks.assign')) return 'Reassign Task';
      return 'No action needed';
    case 'BLOCKED':
      if (isAssignee || has('tasks.block')) return 'Unblock Task';
      if (has('tasks.assign')) return 'Reassign Task';
      return 'No action needed';
    case 'COMPLETED':
      if (has('tasks.close')) return 'Close Task';
      if (has('tasks.manage')) return 'Reopen Task';
      return 'No action needed';
    case 'CLOSED':
    case 'CANCELLED':
      return has('tasks.manage') ? 'Reopen Task' : 'No action needed';
    default:
      return 'No action needed';
  }
}

/**
 * FMP-UI-20G — the Task Detail page's "Next Step" guidance box: one plain
 * sentence explaining what the real task status MEANS, distinct from
 * `computeTaskNextActionText()` (which names the specific button/action).
 * Keyed purely on `status`/`hasAssignee` — real fields, never fabricated —
 * per this unit's own "use real status to choose message, do not fabricate
 * workflow." The brief gave 3 exact sentences (Draft / Open-unassigned /
 * Completed-cancelled-closed); the remaining real states (Assigned/In
 * Progress/Blocked, and the edge case of an already-assigned OPEN task)
 * get the same honest, plain-English treatment so the box is never blank
 * for a real task.
 */
export function computeTaskNextStepGuidance(status: TaskStatus, hasAssignee: boolean): string {
  switch (status) {
    case 'DRAFT':
      return 'This task is still in draft. Open it for work when it is ready to be tracked and assigned.';
    case 'OPEN':
      return hasAssignee
        ? 'This task is open and already assigned.'
        : 'This task is open but not assigned yet. Assign it to the responsible person when assignment is available.';
    case 'ASSIGNED':
      return 'This task has been assigned. Work can begin when the assignee starts it.';
    case 'IN_PROGRESS':
      return 'This task is in progress. Mark it complete when the work is finished.';
    case 'BLOCKED':
      return 'This task is currently blocked. It can resume once the blocker is resolved.';
    case 'COMPLETED':
    case 'CLOSED':
    case 'CANCELLED':
      return 'This task is closed. No further action is required.';
    default:
      return '';
  }
}

export interface TaskViewActions {
  assign: boolean;
  start: boolean;
  complete: boolean;
}

/**
 * FMP-TASK-03 — which buttons the task View popup / row may show. Mirrors the
 * exact rules `task-transitions.tsx` already applies on the full page
 * (Assign: OPEN + tasks.assign; Start Work: DRAFT creator/manager via
 * openTaskAction, or ASSIGNED assignee/tasks.start; Complete: IN_PROGRESS
 * assignee/tasks.complete) — never a button the real page would hide.
 */
export function computeTaskViewActions(task: ActionRow, currentUserId: string, permissions: string[]): TaskViewActions {
  const has = (p: string): boolean => permissions.includes(p);
  const isAssignee = task.assignedToUserId === currentUserId;
  const isCreator = task.createdByUserId === currentUserId;
  return {
    assign: task.status === 'OPEN' && has('tasks.assign'),
    start:
      (task.status === 'DRAFT' && (isCreator || has('tasks.manage'))) ||
      (task.status === 'ASSIGNED' && (isAssignee || has('tasks.start'))),
    complete: task.status === 'IN_PROGRESS' && (isAssignee || has('tasks.complete')),
  };
}

export type TaskQuickActionType ='assign' | 'complete' | 'close';

export interface TaskQuickAction {
  type: TaskQuickActionType;
  label: string;
}

/**
 * FMP-UI-20E — the ONE extra button (beyond "Open Task") the Task Control
 * Center's list shows per row, per the brief's own "Actions column should
 * show clear buttons/links: Open Task, Assign, Complete, Close" — never
 * more than one at a time, and never one the viewer can't actually use.
 * "assign"/"complete" still link to the task's own detail page (assigning
 * needs a person picker, completing needs a summary — neither is a real
 * single-click action); "close" needs no extra input, so the list renders
 * it as a genuine one-click form posting straight to the existing
 * `closeTaskAction` — never a fake button that silently does nothing.
 */
export function computeTaskQuickAction(task: ActionRow, currentUserId: string, permissions: string[]): TaskQuickAction | null {
  const has = (p: string): boolean => permissions.includes(p);
  const isAssignee = task.assignedToUserId === currentUserId;

  switch (task.status) {
    case 'OPEN':
      return has('tasks.assign') ? { type: 'assign', label: 'Assign' } : null;
    case 'IN_PROGRESS':
      return isAssignee || has('tasks.complete') ? { type: 'complete', label: 'Complete' } : null;
    case 'COMPLETED':
      return has('tasks.close') ? { type: 'close', label: 'Close' } : null;
    default:
      return null;
  }
}
