// ---------------------------------------------------------------------------
// CM-40C — contract-first grouping for the Assignment Queue. Pure,
// dependency-free so it can be unit tested directly, matching the pattern
// used by ./contract-dashboard-attention.ts. Operates entirely on the
// WorkflowAssignmentQueueItem[] the CM-40 API already returns — no new
// backend data needed.
// ---------------------------------------------------------------------------

import type { WorkflowAssignmentQueueItem, ContractWorkflowTeam } from '@/lib/contracts-api';

export interface AssignmentQueueContractGroup {
  contractId: string;
  contractReference: string;
  contractTitle: string;
  counterpartyName: string;
  contractStatus: string;
  unassignedCount: number;
  /** Distinct teams with at least one unassigned task on this contract, in board column order. */
  teams: ContractWorkflowTeam[];
  /** Earliest due date among this contract's unassigned tasks, null if none have one set. */
  earliestDueDate: string | null;
}

const TEAM_ORDER: ContractWorkflowTeam[] = ['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL'];

/**
 * Groups a flat unassigned-task list into one row per contract, sorted
 * urgent-first (earliest unassigned-task due date, contracts with no due
 * dates set last, tie-broken by contract reference) — same "date ascending,
 * nulls last" convention as buildAttentionRows() in contract-dashboard-attention.ts.
 */
export function groupAssignmentQueueByContract(items: WorkflowAssignmentQueueItem[]): AssignmentQueueContractGroup[] {
  const byContract = new Map<string, WorkflowAssignmentQueueItem[]>();
  for (const item of items) {
    const list = byContract.get(item.contractId) ?? [];
    list.push(item);
    byContract.set(item.contractId, list);
  }

  const groups: AssignmentQueueContractGroup[] = [];
  for (const contractItems of byContract.values()) {
    const first = contractItems[0]!;
    const teams = TEAM_ORDER.filter((t) => contractItems.some((i) => i.team === t));
    const dueDates = contractItems
      .map((i) => i.dueDate)
      .filter((d): d is string => d !== null)
      .sort();
    groups.push({
      contractId: first.contractId,
      contractReference: first.contractReference,
      contractTitle: first.contractTitle,
      counterpartyName: first.counterpartyName,
      contractStatus: first.contractStatus,
      unassignedCount: contractItems.length,
      teams,
      earliestDueDate: dueDates[0] ?? null,
    });
  }

  return groups.sort((a, b) => {
    if (a.earliestDueDate === b.earliestDueDate) return a.contractReference.localeCompare(b.contractReference);
    if (a.earliestDueDate === null) return 1;
    if (b.earliestDueDate === null) return -1;
    return a.earliestDueDate < b.earliestDueDate ? -1 : 1;
  });
}

/** The subset of the same flat list belonging to one contract — used to drive the focused, per-contract board/table. */
export function getContractQueueItems(items: WorkflowAssignmentQueueItem[], contractId: string): WorkflowAssignmentQueueItem[] {
  return items.filter((i) => i.contractId === contractId);
}
