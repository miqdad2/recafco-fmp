// ---------------------------------------------------------------------------
// CM-71H.3 — a guided erection step reachable via a direct URL (My Tasks,
// the Workflow Board, or a bookmark) before its own prerequisite step has
// reached the right state should show a clear "locked" notice instead of a
// confusing empty/broken form. Mirrors EXACTLY the same "Ready" conditions
// already used by the Workflow & Team Tasks tab's own Step N button-reveal
// logic ([id]/(workspace)/workflow/page.tsx's erectionStepNReady booleans) —
// never a new/different rule. A manager-tier viewer (contracts.update) is
// never locked out — "Contract Manager opens these as View Status /
// monitoring" (CM-71H.2's own task text) — only a non-manager viewer
// (typically the assigned Erection Manager reaching a later step too early)
// sees the locked notice.
// ---------------------------------------------------------------------------

export function isErectionStep2Locked(statement: { status: string } | null): boolean {
  return !statement || (statement.status !== 'SUBMITTED_FOR_APPROVAL' && statement.status !== 'ISSUED');
}

export function isErectionStep3Locked(approval: { reviewStatus: string } | null): boolean {
  return approval?.reviewStatus !== 'APPROVED';
}

export function isErectionStep4Locked(schedule: { status: string } | null): boolean {
  return schedule?.status !== 'ISSUED';
}

export function isErectionStep5Locked(deliveryStart: { status: string } | null): boolean {
  return deliveryStart?.status !== 'STARTED';
}

export function isErectionStep6Locked(erectionStart: { status: string } | null): boolean {
  return erectionStart?.status !== 'STARTED';
}
