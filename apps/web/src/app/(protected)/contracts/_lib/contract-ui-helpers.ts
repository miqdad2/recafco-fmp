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

// ---------------------------------------------------------------------------
// CM-33 — Closeout approval flow: what the "Close Contract" slot in Available
// Actions should show. `getVisibleContractTransitions().close` above is left
// unchanged (still a valid "would this actor be permitted to close, ignoring
// the approval gate" check) but is no longer wired to a direct-close button;
// this function replaces it for the actual UI decision, taking the latest
// closeout request's status into account. Never mutates/closes anything
// itself — purely a rendering decision.
// ---------------------------------------------------------------------------

export interface ClosureAction {
  /** No active/approved request exists (or the most recent one was REJECTED/CANCELLED) — actor with contracts.update may start one. */
  showRequestCloseout: boolean;
  /** A request is SUBMITTED or UNDER_REVIEW — informational only, links to the Closeout tab. */
  pendingStatus: 'SUBMITTED' | 'UNDER_REVIEW' | null;
  /** The latest request is APPROVED — actor with contracts.close may perform the final close. */
  showCloseContract: boolean;
  /** Contract is already CLOSED. */
  showClosedState: boolean;
}

const ACTIVE_OR_TERMINATED = new Set(['ACTIVE', 'TERMINATED']);

export function getClosureAction(
  contractStatus: string,
  permissions: string[],
  latestRequestStatus: string | null | undefined,
): ClosureAction {
  if (contractStatus === 'CLOSED') {
    return { showRequestCloseout: false, pendingStatus: null, showCloseContract: false, showClosedState: true };
  }
  if (!ACTIVE_OR_TERMINATED.has(contractStatus)) {
    // DRAFT — closeout has no meaning yet.
    return { showRequestCloseout: false, pendingStatus: null, showCloseContract: false, showClosedState: false };
  }

  if (latestRequestStatus === 'SUBMITTED' || latestRequestStatus === 'UNDER_REVIEW') {
    return { showRequestCloseout: false, pendingStatus: latestRequestStatus, showCloseContract: false, showClosedState: false };
  }
  if (latestRequestStatus === 'APPROVED') {
    return {
      showRequestCloseout: false,
      pendingStatus: null,
      showCloseContract: permissions.includes('contracts.close'),
      showClosedState: false,
    };
  }

  // No request yet, or the latest one was REJECTED/CANCELLED — a new request may be started.
  return {
    showRequestCloseout: permissions.includes('contracts.update'),
    pendingStatus: null,
    showCloseContract: false,
    showClosedState: false,
  };
}

// ---------------------------------------------------------------------------
// CM-33 — closeout readiness warnings, computed from the checks endpoint.
// Documents are intentionally NOT a blocking condition (no fake document
// rules invented) — only surfaced as an informational warning.
// ---------------------------------------------------------------------------

export interface CloseoutChecksLike {
  workflow: { open: number; overdue: number };
  issues: { open: number };
  claims: { open: number };
  payments: { nonFinalCount: number };
  documents: { count: number };
}

export function computeCloseoutWarnings(checks: CloseoutChecksLike): string[] {
  const warnings: string[] = [];
  if (checks.workflow.open > 0) warnings.push('There are open workflow tasks.');
  if (checks.workflow.overdue > 0) warnings.push('There are overdue workflow tasks.');
  if (checks.issues.open > 0) warnings.push('There are open issues.');
  if (checks.claims.open > 0) warnings.push('There are open claims.');
  if (checks.payments.nonFinalCount > 0) warnings.push('There are outstanding payments.');
  if (checks.documents.count === 0) warnings.push('No closeout documents uploaded.');
  return warnings;
}

// ---------------------------------------------------------------------------
// KWD currency formatting — always 3 decimal places (KWD has fils
// subdivisions), e.g. "KWD 2,550.000". Returns "—" for missing/invalid values.
// ---------------------------------------------------------------------------

export function formatContractValue(value: string | undefined, currency: string | undefined): string {
  if (!value) return '—';
  const amount = parseFloat(value);
  if (isNaN(amount)) return '—';
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return currency ? `${currency} ${formatted}` : formatted;
}

// ---------------------------------------------------------------------------
// Scope of Work / Payment Terms option lists — shared by New Contract
// Register, Edit Contract, and the Contract Detail Overview badges so all
// three surfaces always show identical options.
//
// The 'designProduction' key is preserved for backward compatibility with
// data already saved under that key; only its display label changed to
// "Production Drawings".
// ---------------------------------------------------------------------------

export interface OptionDef {
  key: string;
  label: string;
}

export const SCOPE_OF_WORK_OPTIONS: OptionDef[] = [
  { key: 'shopDrawing', label: 'Shop Drawing' },
  { key: 'designProduction', label: 'Production Drawings' },
  { key: 'production', label: 'Production' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'erection', label: 'Erection' },
  { key: 'exFactory', label: 'Ex-Factory' },
  { key: 'other', label: 'Other' },
  { key: 'notApplicable', label: 'Not Applicable' },
];

export const PAYMENT_TERM_OPTIONS: OptionDef[] = [
  { key: 'advance', label: 'Advance' },
  { key: 'retention', label: 'Retention' },
  { key: 'performanceBond', label: 'Performance Bond' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'interimPayment', label: 'Interim Payment' },
  { key: 'taxClearance', label: 'Tax Clearance' },
];

// ---------------------------------------------------------------------------
// Erection / Crane option lists — shown only when Erection is part of scope.
// Values match the backend's controlled list exactly (CRANE_REQUIRED_OPTIONS /
// CRANE_PROVIDED_BY_OPTIONS in create-contract.dto.ts).
// ---------------------------------------------------------------------------

export const CRANE_REQUIRED_OPTIONS: OptionDef[] = [
  { key: 'YES', label: 'Yes' },
  { key: 'NO', label: 'No' },
  { key: 'NOT_DECIDED', label: 'Not Decided' },
];

export const CRANE_PROVIDED_BY_OPTIONS: OptionDef[] = [
  { key: 'RECAFCO', label: 'RECAFCO' },
  { key: 'CLIENT', label: 'Client' },
  { key: 'THIRD_PARTY', label: 'Third Party' },
  { key: 'NOT_DECIDED', label: 'Not Decided' },
];

export function optionLabel(options: OptionDef[], key: string | undefined): string {
  if (!key) return '—';
  return options.find((o) => o.key === key)?.label ?? key;
}

/** Compact "Shop Drawing, Production, Erection" summary for table cells — returns "—" when nothing is selected. */
export function formatScopeSummary(scope: Record<string, boolean | string> | null | undefined): string {
  if (!scope) return '—';
  const selected = SCOPE_OF_WORK_OPTIONS.filter((o) => scope[o.key] === true).map((o) => o.label);
  return selected.length > 0 ? selected.join(', ') : '—';
}

// ---------------------------------------------------------------------------
// Contract Issue Log (CM-30) — category is a plain string (not a DB enum) for
// flexibility, but still validated against this same controlled list on both
// the frontend and the backend (create-contract-issue.dto.ts).
// ---------------------------------------------------------------------------

export const CONTRACT_ISSUE_CATEGORIES = [
  'Commercial',
  'Technical',
  'Production',
  'Delivery',
  'Erection',
  'Client',
  'Document',
  'Payment',
  'Other',
] as const;

// ---------------------------------------------------------------------------
// Contract Claim Log (CM-31) — claimType/status option lists shared by the
// module-level filter bar and the Add/Edit modal, kept here (not in
// contracts-api.ts) for the same client/server-boundary reason as
// CONTRACT_ISSUE_CATEGORIES above: contracts-api.ts imports next/headers at
// module scope, so any runtime value exported from it breaks client-component
// builds if imported there.
// ---------------------------------------------------------------------------

export const CONTRACT_CLAIM_TYPE_OPTIONS: OptionDef[] = [
  { key: 'VARIATION', label: 'Variation' },
  { key: 'EXTENSION_OF_TIME', label: 'Extension of Time' },
  { key: 'DELAY', label: 'Delay' },
  { key: 'PAYMENT', label: 'Payment' },
  { key: 'DAMAGE', label: 'Damage' },
  { key: 'SCOPE_CHANGE', label: 'Scope Change' },
  { key: 'OTHER', label: 'Other' },
];

export const CONTRACT_CLAIM_STATUS_OPTIONS: OptionDef[] = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'UNDER_NEGOTIATION', label: 'Under Negotiation' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PARTIALLY_APPROVED', label: 'Partially Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SETTLED', label: 'Settled' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export const CONTRACT_CLOSEOUT_STATUS_OPTIONS: OptionDef[] = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

// ---------------------------------------------------------------------------
// CM-43 — Contract List row quick actions. Pure, permission-and-status-driven
// (never a role code, never a free status dropdown — see getVisibleContractTransitions
// above for the same convention). "Open" is always shown separately by the
// caller; this only decides the one primary quick-action slot plus the More
// actions menu contents. `hasPendingCloseout` comes from the caller
// cross-referencing the existing CM-38 closeout register
// (contractsApi.listCloseouts({ pendingOnly: true })) — no new backend data.
// ---------------------------------------------------------------------------

export type ContractPrimaryActionType = 'activate' | 'assignTasks' | 'reviewCloseout' | 'open';

export interface ContractPrimaryAction {
  type: ContractPrimaryActionType;
  label: string;
  /** Present for every type except 'activate', which opens a confirmation dialog instead of navigating. */
  href?: string;
}

export interface ContractRowMoreAction {
  key: string;
  label: string;
  href: string;
}

export interface ContractRowActionPlan {
  primary: ContractPrimaryAction;
  moreActions: ContractRowMoreAction[];
}

export function computeContractRowActionPlan(
  contract: { id: string; status: string },
  permissions: string[],
  hasPendingCloseout: boolean,
): ContractRowActionPlan {
  const id = contract.id;
  const openHref = `/contracts/${id}`;
  const canUpdate = permissions.includes('contracts.update');
  // Same "may this actor review/close" gate as the sidebar's Closeout Requests
  // link (CM-38's @AnyPermission-mirroring anyPermission field) — Review
  // Closeout is a navigation shortcut, not a mutation, so this only decides
  // whether it's worth surfacing as the row's primary slot.
  const canReviewCloseout = canUpdate || permissions.includes('contracts.close');
  const { activate: canActivate } = getVisibleContractTransitions(contract.status, permissions);

  const workflowAction: ContractRowMoreAction = { key: 'workflow', label: 'View Workflow', href: `/contracts/${id}/workflow` };
  const paymentsAction: ContractRowMoreAction = { key: 'payments', label: 'Payments', href: `/contracts/${id}/payments` };
  const issuesAction: ContractRowMoreAction = { key: 'issues', label: 'Issues', href: `/contracts/${id}/issues` };
  const claimsAction: ContractRowMoreAction = { key: 'claims', label: 'Claims', href: `/contracts/${id}/claims` };
  const scheduleAction: ContractRowMoreAction = { key: 'schedule', label: 'Schedule', href: `/contracts/${id}/schedule` };
  const closeoutAction: ContractRowMoreAction = { key: 'closeout', label: 'Closeout', href: `/contracts/${id}/closeout` };

  if (contract.status === 'DRAFT') {
    const moreActions: ContractRowMoreAction[] = [];
    // Edit is DRAFT-only at the route level (edit/page.tsx itself 404s otherwise) —
    // only ever offered here, never in the other branches below.
    if (canUpdate) moreActions.push({ key: 'edit', label: 'Edit', href: `/contracts/${id}/edit` });
    moreActions.push(
      { key: 'schedule', label: 'View Schedule', href: `/contracts/${id}/schedule` },
      workflowAction,
    );
    return {
      primary: canActivate ? { type: 'activate', label: 'Activate' } : { type: 'open', label: 'Open', href: openHref },
      moreActions,
    };
  }

  // A pending closeout request takes priority over the generic Active
  // behavior below, regardless of the exact non-draft/non-closed status
  // (e.g. a request can be pending against a TERMINATED contract too).
  if (hasPendingCloseout && contract.status !== 'CLOSED') {
    return {
      primary: canReviewCloseout
        ? { type: 'reviewCloseout', label: 'Review Closeout', href: closeoutAction.href }
        : { type: 'open', label: 'Open', href: openHref },
      moreActions: [workflowAction, paymentsAction, issuesAction, claimsAction, scheduleAction],
    };
  }

  if (contract.status === 'ACTIVE') {
    return {
      primary: canUpdate
        ? { type: 'assignTasks', label: 'Assign Tasks', href: `/contracts/workflow?mode=assignment&contractId=${id}` }
        : { type: 'open', label: 'Open', href: openHref },
      moreActions: [workflowAction, paymentsAction, issuesAction, claimsAction, scheduleAction, closeoutAction],
    };
  }

  if (contract.status === 'CLOSED') {
    // No Edit, no Activate, no Close from the list — closing is only ever
    // reachable through an approved closeout request (CM-33), never a
    // direct list action.
    return {
      primary: { type: 'open', label: 'Open', href: openHref },
      moreActions: [{ ...closeoutAction, label: 'View Closeout' }, paymentsAction, claimsAction, scheduleAction],
    };
  }

  // Fallback for any other status (in practice, only TERMINATED — the
  // ContractStatus enum has exactly 4 values). Edit is deliberately omitted
  // here even though the actor may hold contracts.update: the edit route
  // itself 404s for any non-DRAFT contract, so offering it here would be a
  // dead link, not a real capability.
  return {
    primary: { type: 'open', label: 'Open', href: openHref },
    moreActions: [workflowAction, paymentsAction, issuesAction, claimsAction, scheduleAction, closeoutAction],
  };
}
