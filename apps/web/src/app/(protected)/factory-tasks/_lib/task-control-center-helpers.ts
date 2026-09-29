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

export type TaskControlCenterTabKey = 'my' | 'assigned-by-me' | 'all' | 'overdue' | 'completed';

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
 * The 5 required tabs, in the brief's own order. My Tasks / Assigned by Me /
 * Overdue / Completed are always visible to any viewer who can reach this
 * page at all (each is scoped to the viewer's OWN tasks, exactly like the
 * existing `/factory-tasks/my` page already is). "All Tasks" is the one tab
 * that shows OTHER people's tasks too, so it's gated behind `tasks.manage`
 * — the existing manager-tier permission `task-transitions.tsx` already
 * uses for broader oversight actions (cancel any task, reopen a closed
 * one) — rather than inventing a brand-new "view all tasks" permission.
 */
export const TASK_CONTROL_CENTER_TABS: TaskControlCenterTab[] = [
  { key: 'my', label: 'My Tasks', viewAllHref: '/factory-tasks/my', emptyMessage: 'No tasks assigned to you.' },
  { key: 'assigned-by-me', label: 'Assigned by Me', viewAllHref: '/factory-tasks/assigned-by-me', emptyMessage: 'No tasks assigned by you.' },
  { key: 'all', label: 'All Tasks', viewAllHref: '/factory-tasks', emptyMessage: 'No tasks found.', requiresPermission: 'tasks.manage' },
  { key: 'overdue', label: 'Overdue', viewAllHref: '/factory-tasks?overdue=true', emptyMessage: 'No overdue tasks.' },
  { key: 'completed', label: 'Completed', viewAllHref: '/factory-tasks?status=COMPLETED,CLOSED', emptyMessage: 'No completed tasks.' },
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
      // FMP-UI-20G — "Open Task" renamed to "Open for Work" to match the
      // real button's own new label (task-transitions.tsx) — the phrase
      // now names the actual lifecycle move (DRAFT → OPEN) instead of
      // reading as "open the page you're already viewing."
      return isCreator || has('tasks.manage') ? 'Open for Work' : 'No action needed';
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

export type TaskQuickActionType = 'assign' | 'complete' | 'close';

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
