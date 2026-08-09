// ---------------------------------------------------------------------------
// Pure, presentation-agnostic helpers for Contract Management UI consistency.
// Kept dependency-free (no React import) so they can be unit tested directly,
// matching the pattern used by ../../_lib/root-dashboard-helpers.ts.
// ---------------------------------------------------------------------------

export interface ContractDepartmentBadgeState {
  hasDepartment: boolean;
  label: string;
}

export function getContractDepartmentBadgeState(
  department: { id: string; name: string } | null | undefined,
): ContractDepartmentBadgeState {
  if (!department) {
    return { hasDepartment: false, label: 'No Department' };
  }
  return { hasDepartment: true, label: department.name };
}

// ---------------------------------------------------------------------------
// Lifecycle transition visibility — driven entirely by permission codes.
// Never takes a role name/code; only actor.permissions may gate visibility.
// ---------------------------------------------------------------------------

export interface VisibleContractTransitions {
  activate: boolean;
  terminate: boolean;
  close: boolean;
}

export function getVisibleContractTransitions(
  status: string,
  permissions: string[],
): VisibleContractTransitions {
  const isDraft = status === 'DRAFT';
  const isActive = status === 'ACTIVE';
  const isTerminated = status === 'TERMINATED';

  return {
    activate: isDraft && permissions.includes('contracts.activate'),
    terminate: isActive && permissions.includes('contracts.terminate'),
    close: (isActive || isTerminated) && permissions.includes('contracts.close'),
  };
}

export function hasAnyVisibleTransition(visible: VisibleContractTransitions): boolean {
  return visible.activate || visible.terminate || visible.close;
}
