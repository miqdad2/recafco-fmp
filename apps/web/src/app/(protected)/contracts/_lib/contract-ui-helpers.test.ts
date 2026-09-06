import { describe, it, expect } from 'vitest';
import {
  getContractDepartmentBadgeState,
  getVisibleContractTransitions,
  hasAnyVisibleTransition,
  formatContractValue,
  formatScopeSummary,
  getClosureAction,
  computeContractRowActionPlan,
  scheduleStatusLabel,
  formatDaysRemainingDisplay,
  SCHEDULE_STATUS_OPTIONS,
  formatScopeCompact,
} from './contract-ui-helpers';

describe('formatScopeSummary', () => {
  it('returns em-dash for null/undefined scope', () => {
    expect(formatScopeSummary(null)).toBe('—');
    expect(formatScopeSummary(undefined)).toBe('—');
  });

  it('returns em-dash when nothing is selected', () => {
    expect(formatScopeSummary({ shopDrawing: false })).toBe('—');
  });

  it('joins selected option labels in canonical order', () => {
    expect(formatScopeSummary({ erection: true, shopDrawing: true })).toBe('Shop Drawing, Erection');
  });

  it('ignores non-boolean-true values (e.g. otherDescription string)', () => {
    expect(formatScopeSummary({ other: true, otherDescription: 'Custom scope text' })).toBe('Other');
  });
});

// ---------------------------------------------------------------------------
// CM-55C — formatScopeCompact
// ---------------------------------------------------------------------------

describe('formatScopeCompact', () => {
  it('returns em-dash display and fullList for null/undefined/empty scope', () => {
    expect(formatScopeCompact(null)).toEqual({ display: '—', fullList: '—' });
    expect(formatScopeCompact({ shopDrawing: false })).toEqual({ display: '—', fullList: '—' });
  });

  it('shows the single label as-is when only one scope is selected', () => {
    expect(formatScopeCompact({ shopDrawing: true })).toEqual({ display: 'Shop Drawing', fullList: 'Shop Drawing' });
  });

  it('shows "First Label +N" when more than one scope is selected, keeping fullList complete', () => {
    const result = formatScopeCompact({ shopDrawing: true, production: true, delivery: true, erection: true, exFactory: true });
    expect(result.display).toBe('Shop Drawing +4');
    expect(result.fullList).toBe('Shop Drawing, Production, Delivery, Erection, Ex-Factory');
  });

  it('never changes formatScopeSummary\'s own behavior — fullList always matches it exactly', () => {
    const scope = { erection: true, shopDrawing: true };
    expect(formatScopeCompact(scope).fullList).toBe(formatScopeSummary(scope));
  });
});

// ---------------------------------------------------------------------------
// getContractDepartmentBadgeState
// covers: list page department badge rendering, no-department warning badge,
// detail page department information
// ---------------------------------------------------------------------------

describe('getContractDepartmentBadgeState', () => {
  it('returns a "No Department" warning state when department is null', () => {
    const state = getContractDepartmentBadgeState(null);
    expect(state.hasDepartment).toBe(false);
    expect(state.label).toBe('No Department');
  });

  it('returns a "No Department" warning state when department is undefined', () => {
    const state = getContractDepartmentBadgeState(undefined);
    expect(state.hasDepartment).toBe(false);
    expect(state.label).toBe('No Department');
  });

  it('returns the department name when a department is present (list row renders correctly)', () => {
    const state = getContractDepartmentBadgeState({ id: 'dept-1', name: 'Engineering' });
    expect(state.hasDepartment).toBe(true);
    expect(state.label).toBe('Engineering');
  });
});

// ---------------------------------------------------------------------------
// getVisibleContractTransitions
// covers: lifecycle actions shown/hidden by permission, contract-transitions
// component's expected action set, role-name-agnostic authorization
// ---------------------------------------------------------------------------

describe('getVisibleContractTransitions', () => {
  it('shows Activate only for DRAFT contracts with contracts.activate permission', () => {
    const visible = getVisibleContractTransitions('DRAFT', ['contracts.activate']);
    expect(visible).toEqual({ activate: true, terminate: false, close: false, cancel: false, cancelLabel: null });
  });

  it('hides Activate when contracts.activate permission is absent, even for a DRAFT contract', () => {
    const visible = getVisibleContractTransitions('DRAFT', ['contracts.read']);
    expect(visible.activate).toBe(false);
  });

  it('hides Activate for a non-DRAFT contract even with the permission present', () => {
    const visible = getVisibleContractTransitions('ACTIVE', ['contracts.activate']);
    expect(visible.activate).toBe(false);
  });

  it('shows Terminate only for ACTIVE contracts with contracts.terminate permission', () => {
    const visible = getVisibleContractTransitions('ACTIVE', ['contracts.terminate']);
    expect(visible).toEqual({ activate: false, terminate: true, close: false, cancel: false, cancelLabel: null });
  });

  it('hides Terminate without contracts.terminate permission', () => {
    const visible = getVisibleContractTransitions('ACTIVE', ['contracts.read']);
    expect(visible.terminate).toBe(false);
  });

  it('shows Close for ACTIVE or TERMINATED contracts with contracts.close permission', () => {
    expect(getVisibleContractTransitions('ACTIVE', ['contracts.close']).close).toBe(true);
    expect(getVisibleContractTransitions('TERMINATED', ['contracts.close']).close).toBe(true);
  });

  it('hides Close for DRAFT or CLOSED contracts regardless of permission', () => {
    expect(getVisibleContractTransitions('DRAFT', ['contracts.close']).close).toBe(false);
    expect(getVisibleContractTransitions('CLOSED', ['contracts.close']).close).toBe(false);
  });

  it('hides Close without contracts.close permission', () => {
    expect(getVisibleContractTransitions('ACTIVE', []).close).toBe(false);
  });

  it('returns all actions visible for a full-permission actor on an ACTIVE contract', () => {
    const visible = getVisibleContractTransitions('ACTIVE', [
      'contracts.activate',
      'contracts.terminate',
      'contracts.close',
    ]);
    expect(visible).toEqual({ activate: false, terminate: true, close: true, cancel: false, cancelLabel: null });
  });

  it('shows Cancel Contract for an ACTIVE contract when the actor has contracts.update or contracts.manage', () => {
    expect(getVisibleContractTransitions('ACTIVE', ['contracts.update'])).toMatchObject({
      cancel: true,
      cancelLabel: 'Cancel Contract',
    });
    expect(getVisibleContractTransitions('ACTIVE', ['contracts.manage'])).toMatchObject({
      cancel: true,
      cancelLabel: 'Cancel Contract',
    });
  });

  it('shows Remove Draft (not Cancel Contract) for a DRAFT contract', () => {
    expect(getVisibleContractTransitions('DRAFT', ['contracts.update'])).toMatchObject({
      cancel: true,
      cancelLabel: 'Remove Draft',
    });
  });

  it('hides Cancel/Remove Draft without contracts.update or contracts.manage', () => {
    expect(getVisibleContractTransitions('ACTIVE', ['contracts.read']).cancel).toBe(false);
    expect(getVisibleContractTransitions('DRAFT', ['contracts.read']).cancel).toBe(false);
  });

  it('hides Cancel/Remove Draft for TERMINATED or CLOSED contracts regardless of permission', () => {
    expect(getVisibleContractTransitions('TERMINATED', ['contracts.update', 'contracts.manage']).cancel).toBe(false);
    expect(getVisibleContractTransitions('CLOSED', ['contracts.update', 'contracts.manage']).cancel).toBe(false);
  });

  it('CM-69E — hides Cancel for an already-CANCELLED contract regardless of permission (no re-cancelling)', () => {
    const visible = getVisibleContractTransitions('CANCELLED', ['contracts.update', 'contracts.manage']);
    expect(visible.cancel).toBe(false);
    expect(visible.cancelLabel).toBeNull();
  });

  it('decides visibility purely from the permissions array, not from any role name or code', () => {
    // getVisibleContractTransitions accepts only (status, permissions) — there is no
    // role/roleCode/roleName parameter it could branch on. Two "roles" that carry the
    // same permission set must produce identical results.
    const adminLikePermissions = ['contracts.activate'];
    const viewerLikePermissions = ['contracts.activate'];
    expect(getVisibleContractTransitions('DRAFT', adminLikePermissions)).toEqual(
      getVisibleContractTransitions('DRAFT', viewerLikePermissions),
    );
  });
});

// ---------------------------------------------------------------------------
// hasAnyVisibleTransition
// ---------------------------------------------------------------------------

describe('hasAnyVisibleTransition', () => {
  it('returns false when no transition is visible (component renders nothing)', () => {
    expect(hasAnyVisibleTransition({ activate: false, terminate: false, close: false, cancel: false, cancelLabel: null })).toBe(false);
  });

  it('returns true when at least one transition is visible', () => {
    expect(hasAnyVisibleTransition({ activate: true, terminate: false, close: false, cancel: false, cancelLabel: null })).toBe(true);
    expect(hasAnyVisibleTransition({ activate: false, terminate: false, close: true, cancel: false, cancelLabel: null })).toBe(true);
  });

  it('returns true when only Cancel/Remove Draft is visible', () => {
    expect(hasAnyVisibleTransition({ activate: false, terminate: false, close: false, cancel: true, cancelLabel: 'Cancel Contract' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatContractValue
// ---------------------------------------------------------------------------

describe('formatContractValue', () => {
  it('formats with 3 decimal places and a currency prefix', () => {
    expect(formatContractValue('25.5', 'KWD')).toBe('KWD 25.500');
  });

  it('adds thousands separators', () => {
    expect(formatContractValue('2550', 'KWD')).toBe('KWD 2,550.000');
  });

  it('omits the currency prefix when currency is missing', () => {
    expect(formatContractValue('2550', undefined)).toBe('2,550.000');
  });

  it('returns em dash for missing value', () => {
    expect(formatContractValue(undefined, 'KWD')).toBe('—');
  });

  it('returns em dash for unparseable value', () => {
    expect(formatContractValue('not-a-number', 'KWD')).toBe('—');
  });
});

describe('getClosureAction', () => {
  it('shows nothing for a DRAFT contract', () => {
    expect(getClosureAction('DRAFT', ['contracts.update', 'contracts.close'], null)).toEqual({
      showRequestCloseout: false, pendingStatus: null, showCloseContract: false, showClosedState: false,
    });
  });

  it('shows closed state for a CLOSED contract, regardless of any request status', () => {
    expect(getClosureAction('CLOSED', ['contracts.update', 'contracts.close'], 'CLOSED')).toEqual({
      showRequestCloseout: false, pendingStatus: null, showCloseContract: false, showClosedState: true,
    });
  });

  it('shows Request Closeout when there is no request yet and actor has contracts.update', () => {
    expect(getClosureAction('ACTIVE', ['contracts.update'], null)).toEqual({
      showRequestCloseout: true, pendingStatus: null, showCloseContract: false, showClosedState: false,
    });
  });

  it('hides Request Closeout without contracts.update', () => {
    expect(getClosureAction('ACTIVE', ['contracts.read'], null)).toEqual({
      showRequestCloseout: false, pendingStatus: null, showCloseContract: false, showClosedState: false,
    });
  });

  it('shows Request Closeout again after a REJECTED or CANCELLED request', () => {
    expect(getClosureAction('ACTIVE', ['contracts.update'], 'REJECTED').showRequestCloseout).toBe(true);
    expect(getClosureAction('ACTIVE', ['contracts.update'], 'CANCELLED').showRequestCloseout).toBe(true);
  });

  it('shows pending status (no action buttons) for SUBMITTED/UNDER_REVIEW', () => {
    expect(getClosureAction('ACTIVE', ['contracts.close'], 'SUBMITTED')).toEqual({
      showRequestCloseout: false, pendingStatus: 'SUBMITTED', showCloseContract: false, showClosedState: false,
    });
    expect(getClosureAction('TERMINATED', ['contracts.close'], 'UNDER_REVIEW').pendingStatus).toBe('UNDER_REVIEW');
  });

  it('shows Close Contract only for APPROVED requests, gated on contracts.close', () => {
    expect(getClosureAction('ACTIVE', ['contracts.close'], 'APPROVED').showCloseContract).toBe(true);
    expect(getClosureAction('ACTIVE', ['contracts.update'], 'APPROVED').showCloseContract).toBe(false);
  });

  it('never shows a direct-close button — only the closeout-gated one', () => {
    // No status value in this function's contract represents "direct close";
    // showCloseContract is only ever true when pendingStatus resolved to APPROVED.
    const allStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'CANCELLED', 'APPROVED', 'CLOSED', null];
    for (const s of allStatuses) {
      const action = getClosureAction('ACTIVE', ['contracts.close'], s);
      if (action.showCloseContract) expect(s).toBe('APPROVED');
    }
  });
});

// ---------------------------------------------------------------------------
// computeContractRowActionPlan (CM-43)
// covers: Contract List row quick actions — primary slot + More actions menu
// ---------------------------------------------------------------------------

describe('computeContractRowActionPlan', () => {
  const MANAGER_PERMS = ['contracts.read', 'contracts.update', 'contracts.activate', 'contracts.close'];
  const STAFF_PERMS = ['contracts.read', 'contracts.workflow_update'];

  it('Draft + contracts.activate: primary is Activate, More includes Edit/Schedule/Workflow, no Payments/Issues/Claims/Closeout', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'DRAFT' }, MANAGER_PERMS, false);
    expect(plan.primary).toEqual({ type: 'activate', label: 'Activate' });
    expect(plan.moreActions.map((a) => a.key)).toEqual(['edit', 'schedule', 'workflow']);
    expect(plan.moreActions.find((a) => a.key === 'edit')?.href).toBe('/contracts/c1/edit');
  });

  it('Draft without contracts.activate: primary falls back to Open (never shows a button the backend would reject)', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'DRAFT' }, ['contracts.read', 'contracts.update'], false);
    expect(plan.primary).toEqual({ type: 'open', label: 'Open', href: '/contracts/c1' });
  });

  it('Draft without contracts.update: More actions omits Edit', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'DRAFT' }, STAFF_PERMS, false);
    expect(plan.moreActions.some((a) => a.key === 'edit')).toBe(false);
  });

  it('Active + contracts.update: primary is Assign Tasks routed to the module Assignment Queue with contractId', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'ACTIVE' }, MANAGER_PERMS, false);
    expect(plan.primary).toEqual({
      type: 'assignTasks', label: 'Assign Tasks', href: '/contracts/workflow?mode=assignment&contractId=c1',
    });
    expect(plan.moreActions.map((a) => a.key)).toEqual(['workflow', 'payments', 'issues', 'claims', 'schedule', 'closeout']);
  });

  it('Active without contracts.update: primary falls back to Open (Assign Tasks is a manager-tier action)', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'ACTIVE' }, STAFF_PERMS, false);
    expect(plan.primary).toEqual({ type: 'open', label: 'Open', href: '/contracts/c1' });
  });

  it('never closes directly from the list: Active More actions has no "Close" item', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'ACTIVE' }, MANAGER_PERMS, false);
    expect(plan.moreActions.some((a) => a.label.toLowerCase().includes('close contract'))).toBe(false);
  });

  it('pending closeout takes priority over the generic Active behavior: primary is Review Closeout', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'ACTIVE' }, MANAGER_PERMS, true);
    expect(plan.primary).toEqual({ type: 'reviewCloseout', label: 'Review Closeout', href: '/contracts/c1/closeout' });
    expect(plan.moreActions.map((a) => a.key)).toEqual(['workflow', 'payments', 'issues', 'claims', 'schedule']);
  });

  it('pending closeout without review permission: primary falls back to Open', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'ACTIVE' }, STAFF_PERMS, true);
    expect(plan.primary).toEqual({ type: 'open', label: 'Open', href: '/contracts/c1' });
  });

  it('pending closeout also takes priority for a Terminated contract', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'TERMINATED' }, MANAGER_PERMS, true);
    expect(plan.primary.type).toBe('reviewCloseout');
  });

  it('Closed: primary is Open, More has View Closeout/Payments/Claims/Schedule only — no Edit, no Activate, no Workflow, no Issues', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'CLOSED' }, MANAGER_PERMS, false);
    expect(plan.primary).toEqual({ type: 'open', label: 'Open', href: '/contracts/c1' });
    expect(plan.moreActions.map((a) => a.key)).toEqual(['closeout', 'payments', 'claims', 'schedule']);
    expect(plan.moreActions.find((a) => a.key === 'closeout')?.label).toBe('View Closeout');
  });

  it('a pending closeout request never overrides an already-Closed contract', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'CLOSED' }, MANAGER_PERMS, true);
    expect(plan.primary).toEqual({ type: 'open', label: 'Open', href: '/contracts/c1' });
  });

  it('Terminated (fallback branch): primary is Open, More has Workflow/Payments/Issues/Claims/Schedule/Closeout but never Edit (edit route is DRAFT-only)', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'TERMINATED' }, MANAGER_PERMS, false);
    expect(plan.primary).toEqual({ type: 'open', label: 'Open', href: '/contracts/c1' });
    expect(plan.moreActions.map((a) => a.key)).toEqual(['workflow', 'payments', 'issues', 'claims', 'schedule', 'closeout']);
    expect(plan.moreActions.some((a) => a.key === 'edit')).toBe(false);
  });

  it('Cancelled (CM-69A, same fallback branch as Terminated): primary is Open, never Edit or Activate from the list', () => {
    const plan = computeContractRowActionPlan({ id: 'c1', status: 'CANCELLED' }, MANAGER_PERMS, false);
    expect(plan.primary).toEqual({ type: 'open', label: 'Open', href: '/contracts/c1' });
    expect(plan.moreActions.some((a) => a.key === 'edit')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CM-55 — schedule/progress status + days remaining
// ---------------------------------------------------------------------------

describe('SCHEDULE_STATUS_OPTIONS', () => {
  it('has exactly the 5 manager-approved statuses in order, no At Risk / On Hold / Terminated', () => {
    expect(SCHEDULE_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'IN_PROGRESS', 'ON_TRACK', 'DELAYED', 'COMPLETED', 'AHEAD_OF_SCHEDULE',
    ]);
    expect(SCHEDULE_STATUS_OPTIONS.map((o) => o.label)).toEqual([
      'In Progress', 'On Track', 'Delayed', 'Completed', 'Ahead of Schedule',
    ]);
  });
});

describe('scheduleStatusLabel', () => {
  it('maps each value to its label', () => {
    expect(scheduleStatusLabel('DELAYED')).toBe('Delayed');
    expect(scheduleStatusLabel('AHEAD_OF_SCHEDULE')).toBe('Ahead of Schedule');
  });

  it('defaults to "In Progress" for an unknown/undefined value rather than throwing', () => {
    expect(scheduleStatusLabel(undefined)).toBe('In Progress');
    expect(scheduleStatusLabel('SOMETHING_ELSE')).toBe('In Progress');
  });
});

describe('formatDaysRemainingDisplay', () => {
  it('returns em-dash with no overdue/dueSoon flags when neither date exists', () => {
    expect(formatDaysRemainingDisplay(undefined, undefined)).toEqual({ label: '—', overdue: false, dueSoon: false });
  });

  it('prefers forecastCompletionDate over endDate when both are present', () => {
    const today = new Date();
    const forecast = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatDaysRemainingDisplay(forecast, end);
    expect(result.dueSoon).toBe(true);
  });

  it('falls back to endDate when forecastCompletionDate is absent', () => {
    const today = new Date();
    const end = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatDaysRemainingDisplay(undefined, end);
    expect(result.dueSoon).toBe(true);
    expect(result.overdue).toBe(false);
  });

  it('marks a past date as overdue', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatDaysRemainingDisplay(past, undefined);
    expect(result.overdue).toBe(true);
    expect(result.label).toContain('overdue');
  });

  it('does not mark a date more than 30 days out as dueSoon', () => {
    const future = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatDaysRemainingDisplay(future, undefined);
    expect(result.dueSoon).toBe(false);
    expect(result.overdue).toBe(false);
  });
});
