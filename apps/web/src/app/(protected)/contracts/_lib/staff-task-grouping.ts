import type { ContractWorkflowTask } from '@/lib/contracts-api';

// ---------------------------------------------------------------------------
// CM-44 — groups a Contract Staff member's own assigned workflow tasks
// (already fetched, flattened across their contracts) into the 5 sections
// the Staff My Tasks page shows. Pure, dependency-free, matching the
// established pattern used by assignment-queue-grouping.ts (CM-40C) and
// contract-dashboard-attention.ts (CM-39B).
// ---------------------------------------------------------------------------

/**
 * One of the staff member's own tasks, enriched with the contract identity
 * and sibling-task context the flat task itself doesn't carry. `teamTasks`
 * is every task on the same contract in this task's team (sorted by
 * sortOrder) — the fixed, backend-defined step sequence within a team (e.g.
 * TECHNICAL: Drawing Received → SD & Calculation Submission → Getting
 * Approval → FD Issuance) — used to render the focused task screen's simple
 * workflow-progress stepper and to derive the current/next stage name,
 * without inventing a "workflow stage" concept the data model doesn't have.
 */
export interface StaffFlatTask extends ContractWorkflowTask {
  contractReference: string;
  contractTitle: string;
  counterpartyName: string;
  contractManagerName: string;
  teamTasks: ContractWorkflowTask[];
  /** CM-71H.3 — true only for a guided erection task (Steps 2-6) whose own CM-71A-G prerequisite record hasn't reached the required state yet. Always false/undefined for a non-guided task or Step 1 (no prerequisite). */
  guidedStepLocked?: boolean;
}

export type StaffTaskBucketKey = 'overdue' | 'open' | 'inProgress' | 'submittedUnderReview' | 'completed';

export interface StaffTaskBucket {
  key: StaffTaskBucketKey;
  label: string;
  tasks: StaffFlatTask[];
}

/**
 * Overdue is checked first and takes priority over every status bucket below
 * (a task is never shown twice) — this matches how the manager dashboard's
 * own "Needs Manager Action" list treats overdue as the most urgent signal.
 * ON_HOLD and REJECTED (without a past due date) fall into "In Progress" —
 * there's no dedicated section for them in the spec's fixed 5-section list,
 * and both represent active, unfinished work still needing the staff
 * member's attention, not a completed or not-yet-started task.
 */
export function groupStaffTasksByBucket(tasks: StaffFlatTask[]): StaffTaskBucket[] {
  const overdue = tasks.filter((t) => t.isOverdue);
  const rest = tasks.filter((t) => !t.isOverdue);

  const open = rest.filter((t) => t.status === 'NOT_STARTED');
  const inProgress = rest.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ON_HOLD' || t.status === 'REJECTED');
  const submittedUnderReview = rest.filter((t) => t.status === 'SUBMITTED' || t.status === 'UNDER_REVIEW');
  const completed = rest.filter((t) => t.status === 'COMPLETED' || t.status === 'APPROVED');

  return [
    { key: 'overdue', label: 'Overdue', tasks: overdue },
    { key: 'open', label: 'My Open Tasks', tasks: open },
    { key: 'inProgress', label: 'In Progress', tasks: inProgress },
    { key: 'submittedUnderReview', label: 'Submitted / Under Review', tasks: submittedUnderReview },
    { key: 'completed', label: 'Completed', tasks: completed },
  ];
}
