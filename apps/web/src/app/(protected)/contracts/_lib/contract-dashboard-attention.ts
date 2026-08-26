// ---------------------------------------------------------------------------
// CM-39B — Frontend-only grouping/reordering/capping of the manager dashboard
// "Needs Manager Action" list. Pure, dependency-free so it can be unit tested
// directly, matching the pattern used by ./contract-ui-helpers.ts.
//
// The backend (ContractDashboardService.buildManagerAttentionItems) still
// returns one row per draft contract / per contract-with-unassigned-tasks,
// sorted HIGH>MEDIUM>LOW then date, capped at 30. This module takes that
// array plus the (uncapped, accurate) summary counts and workflow overview,
// and derives a short, de-duplicated, action-type-ordered list for display.
// No backend change — see MANAGER_ATTENTION_LIST_CAP caveat in ui-registry.md.
// ---------------------------------------------------------------------------

import type { ManagerAttentionItem, ManagerDashboardSummary, TeamWorkflowOverview } from '@/lib/contracts-api';

export interface AttentionDisplayRow {
  key: string;
  priority: ManagerAttentionItem['priority'];
  typeLabel: string;
  /** Grouped rows (multiple contracts) have no single contract to link to. */
  contractHref: string | null;
  contractLabel: string;
  contractTitle: string | null;
  description: string;
  date: string | null;
  isOverdue: boolean;
  overdueDays: number | null;
  actionUrl: string;
  actionLabel: string;
}

export const ATTENTION_ROW_CAP = 5;

// Urgent-first order requested by CM-39B — distinct from the backend's plain
// HIGH/MEDIUM/LOW priority bucket sort. CONTRACT_ENDING_SOON isn't named in
// the spec's ordering; placed after payments as a lower-urgency informational
// item, ahead of the two grouped/summary rows which are intentionally last.
const TYPE_ORDER: Record<string, number> = {
  CLOSEOUT_REVIEW: 0,
  OVERDUE_TASK: 1,
  OPEN_ISSUE: 2,
  OPEN_CLAIM: 3,
  OUTSTANDING_PAYMENT: 4,
  CONTRACT_ENDING_SOON: 5,
  ASSIGN_TASKS: 6,
  ACTIVATE_CONTRACT: 7,
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  ACTIVATE_CONTRACT: 'Activate Contracts',
  ASSIGN_TASKS: 'Assign Tasks',
  OVERDUE_TASK: 'Overdue Task',
  OPEN_ISSUE: 'Open Issue',
  OPEN_CLAIM: 'Open Claim',
  OUTSTANDING_PAYMENT: 'Outstanding Payment',
  CLOSEOUT_REVIEW: 'Closeout Review',
  CONTRACT_ENDING_SOON: 'Ending Soon',
};

/**
 * Groups ACTIVATE_CONTRACT and ASSIGN_TASKS items into one summary row each
 * (using accurate, uncapped counts from `summary`/`workflowOverview` rather
 * than counting rows in the possibly-capped `items` array), reorders the
 * result by urgency type, and returns the full (ungrouped-count-aware) list —
 * callers slice to ATTENTION_ROW_CAP for display.
 */
export function buildAttentionRows(
  items: ManagerAttentionItem[],
  summary: ManagerDashboardSummary | undefined,
  workflowOverview: TeamWorkflowOverview[],
): AttentionDisplayRow[] {
  const rows: { row: AttentionDisplayRow; typeKey: string }[] = [];

  for (const item of items) {
    if (item.actionType === 'ACTIVATE_CONTRACT' || item.actionType === 'ASSIGN_TASKS') continue;
    rows.push({
      typeKey: item.actionType,
      row: {
        key: item.key,
        priority: item.priority,
        typeLabel: ACTION_TYPE_LABELS[item.actionType] ?? item.actionType,
        contractHref: `/contracts/${item.contractId}`,
        contractLabel: item.contractReference,
        contractTitle: item.contractTitle,
        description: item.description,
        date: item.date,
        isOverdue: item.isOverdue,
        overdueDays: item.overdueDays,
        actionUrl: item.actionUrl,
        actionLabel: item.actionLabel,
      },
    });
  }

  const draftCount = summary?.contractsAwaitingActivation ?? items.filter((i) => i.actionType === 'ACTIVATE_CONTRACT').length;
  if (draftCount > 0) {
    rows.push({
      typeKey: 'ACTIVATE_CONTRACT',
      row: {
        key: 'GROUP:ACTIVATE_CONTRACT',
        priority: 'MEDIUM',
        typeLabel: 'Activate Contracts',
        contractHref: null,
        contractLabel: `${draftCount} draft contract${draftCount === 1 ? '' : 's'}`,
        contractTitle: null,
        description: 'Draft contracts awaiting activation',
        date: null,
        isOverdue: false,
        overdueDays: null,
        actionUrl: '/contracts?status=DRAFT',
        actionLabel: 'View Draft Contracts',
      },
    });
  }

  const assignItems = items.filter((i) => i.actionType === 'ASSIGN_TASKS');
  const unassignedTaskTotal = workflowOverview.reduce((sum, t) => sum + t.unassignedTasks, 0);
  if (assignItems.length > 0 || unassignedTaskTotal > 0) {
    const contractCount = assignItems.length;
    const taskLabel = `${unassignedTaskTotal} unassigned workflow task${unassignedTaskTotal === 1 ? '' : 's'}`;
    const contractSuffix = contractCount > 0 ? ` across ${contractCount} contract${contractCount === 1 ? '' : 's'}` : '';
    rows.push({
      typeKey: 'ASSIGN_TASKS',
      row: {
        key: 'GROUP:ASSIGN_TASKS',
        priority: 'HIGH',
        typeLabel: 'Assign Tasks',
        contractHref: null,
        contractLabel: contractCount > 0 ? `${contractCount} contract${contractCount === 1 ? '' : 's'}` : 'Multiple contracts',
        contractTitle: null,
        description: `${taskLabel}${contractSuffix}`,
        date: null,
        isOverdue: false,
        overdueDays: null,
        actionUrl: '/contracts/workflow?mode=assignment',
        actionLabel: 'Assign Tasks',
      },
    });
  }

  rows.sort((a, b) => {
    const orderA = TYPE_ORDER[a.typeKey] ?? 99;
    const orderB = TYPE_ORDER[b.typeKey] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    if (a.row.date === b.row.date) return 0;
    if (a.row.date === null) return 1;
    if (b.row.date === null) return -1;
    return a.row.date < b.row.date ? -1 : 1;
  });

  return rows.map((r) => r.row);
}
