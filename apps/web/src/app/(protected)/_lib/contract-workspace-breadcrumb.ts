import type { BreadcrumbItem } from '../_components/breadcrumbs';

// CM-66D — pure route-shape check deciding whether the current pathname is
// a Contract Detail workspace page (Overview or one of its tabs), so the
// global TopHeader knows when to show the "Contract Management > Contract
// List > Contract Detail" breadcrumb at header level instead of the page
// body rendering its own copy.
//
// Distinguishes /contracts/[id](/<tab>)? from every other /contracts/*
// route by file-system routing shape, not by guessing at UUID format:
// - CONTRACT_MODULE_SEGMENTS are the real literal top-level folders that
//   sit as siblings of [id] under contracts/ (module list/register pages).
// - WORKSPACE_TAB_SEGMENTS are the real folder names inside
//   contracts/[id]/(workspace)/ (the tabs themselves).
// /contracts/[id]/edit is deliberately excluded — it lives OUTSIDE the
// (workspace) route group (a sibling of it, not a child), has its own
// distinct breadcrumb with the real contract reference number, and does
// not render the workspace tab bar.
const CONTRACT_MODULE_SEGMENTS = new Set([
  'dashboard',
  'new',
  'workflow',
  'schedule',
  'payments',
  'issues',
  'claims',
  'closeouts',
  'closeout',
  'erection-dashboard',
]);

const WORKSPACE_TAB_SEGMENTS = new Set([
  'schedule',
  'payments',
  'production',
  'variations',
  'claims',
  'risks',
  'documents',
  'workflow',
  'issues',
  'attachments',
  'activity',
  'closeout',
]);

export function isContractWorkspaceDetailPath(pathname: string): boolean {
  const match = /^\/contracts\/([^/]+)(?:\/([^/]+))?/.exec(pathname);
  if (!match) return false;
  const [, first, second] = match;
  if (!first || CONTRACT_MODULE_SEGMENTS.has(first)) return false;
  if (second === undefined) return true;
  return WORKSPACE_TAB_SEGMENTS.has(second);
}

// CM-66E — the Contract Management module's other list/register pages all
// render the exact same STATIC breadcrumb shape (fixed labels, no per-record
// data) — unlike /contracts/[id]/edit, which is deliberately excluded here
// because its breadcrumb includes the real contract.referenceNumber and so
// cannot be derived from the pathname alone. Keyed by exact pathname rather
// than by route-shape regex since each of these is a single fixed route
// (not a dynamic-segment family like the workspace tabs above).
//
// /contracts/workflow is NOT in this static map — see
// contractWorkflowBreadcrumbItems() below, which handles its 3 query-param
// variants instead.
const MODULE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  '/contracts/dashboard': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Dashboard' },
  ],
  '/contracts': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Contract List' },
  ],
  '/contracts/new': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Contract List', href: '/contracts' },
    { label: 'New Contract Register' },
  ],
  '/contracts/schedule': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Schedule' },
  ],
  '/contracts/payments': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Payments' },
  ],
  '/contracts/issues': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Issue Log' },
  ],
  '/contracts/claims': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Claim Log' },
  ],
  '/contracts/closeouts': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Closeout Requests' },
  ],
  '/contracts/erection-dashboard': [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Erection Dashboard' },
  ],
};

export function contractModuleBreadcrumbItems(pathname: string): BreadcrumbItem[] | undefined {
  return MODULE_BREADCRUMBS[pathname];
}

// CM-66F — /contracts/workflow renders 3 different breadcrumbs depending on
// query params, mirroring the EXACT same mode-resolution rules as
// contracts/workflow/page.tsx (isAssignmentMode / isStaffOnly +
// isOverdueMode|isMyTasksMode), so this function reads the same params the
// page itself does. isStaffOnly must be passed in (derived from
// isContractStaffOnlyAccess(user.permissions), already available on the
// ShellUser the header already has) since it can't be read from the URL.
// A staff-only user can never actually be sitting on ?mode=assignment (the
// page redirects them away from it server-side before render), so this
// function doesn't need to re-check canManage — by the time this runs
// client-side, the URL already reflects wherever the page decided to land.
export function contractWorkflowBreadcrumbItems(
  pathname: string,
  searchParams: URLSearchParams,
  isStaffOnly: boolean,
): BreadcrumbItem[] | undefined {
  if (pathname !== '/contracts/workflow') return undefined;

  const mode = searchParams.get('mode');
  const isAssignmentMode = mode === 'assignment' || searchParams.get('assignmentOnly') === 'true';
  const isOverdueMode = mode === 'overdue' || searchParams.get('overdueOnly') === 'true';
  const isMyTasksMode = mode === 'my-tasks' || searchParams.get('myTasksOnly') === 'true';

  if (isAssignmentMode) {
    return [
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract Work Progress', href: '/contracts/workflow' },
      { label: 'Assign Work' },
    ];
  }

  if (isStaffOnly && (isOverdueMode || isMyTasksMode)) {
    return [
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: isOverdueMode ? 'Overdue Tasks' : 'My Tasks' },
    ];
  }

  return [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Contract Work Progress' },
  ];
}

// CM-71H.6 — a staff-tier (Erection Manager / Contract Staff) viewer never
// sees the manager-only "Contract Detail"/"Workflow & Team Tasks" chain
// (those pages are redirected away from — see (workspace)/layout.tsx —
// and the focused erection view hides the tab bar those crumbs would have
// led to anyway); they get the 2-level "Contract Management > My Tasks"
// chain instead, mirroring contractWorkflowBreadcrumbItems' own existing
// staff-tier precedent above. isStaffOnly must be passed in (derived from
// isContractStaffOnlyAccess(user.permissions), already available on the
// ShellUser top-header.tsx already has) since it can't be read from the
// URL. A manager-tier viewer keeps the exact same 5-level chain as before.
function buildErectionStepBreadcrumb(contractId: string, stepLabel: string, isStaffOnly: boolean): BreadcrumbItem[] {
  if (isStaffOnly) {
    return [
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' },
      { label: stepLabel },
    ];
  }
  return [
    { label: 'Contract Management', href: '/contracts/dashboard' },
    { label: 'Contract List', href: '/contracts' },
    { label: 'Contract Detail', href: `/contracts/${contractId}` },
    { label: 'Workflow & Team Tasks', href: `/contracts/${contractId}/workflow` },
    { label: stepLabel },
  ];
}

// CM-71A — /contracts/[id]/workflow/erection/method-statement is nested two
// levels below the Workflow tab itself, so it needs one more breadcrumb
// level than the generic 3-level WORKSPACE_DETAIL_BREADCRUMB fallback
// (isContractWorkspaceDetailPath would otherwise match it too, since its
// regex only inspects the first 2 path segments after /contracts/). Checked
// in top-header.tsx BEFORE that generic fallback so it wins for this one
// route shape; every other workspace tab is unaffected. contractId is read
// directly from the pathname (never fetched) — same "derive from the URL
// alone" approach as contractWorkflowBreadcrumbItems above.
export function contractErectionMethodStatementBreadcrumbItems(pathname: string, isStaffOnly: boolean): BreadcrumbItem[] | undefined {
  const match = /^\/contracts\/([^/]+)\/workflow\/erection\/method-statement\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, contractId] = match;

  return buildErectionStepBreadcrumb(contractId!, 'Issue Erection Method Statement', isStaffOnly);
}

// CM-71C — same reasoning as contractErectionMethodStatementBreadcrumbItems
// above, one level deeper (Step 2 sits under .../method-statement/approval).
// A separate dedicated function per route shape, not a shared regex with an
// optional suffix — matches this file's own established one-function-per-
// special-route convention.
export function contractErectionMethodStatementApprovalBreadcrumbItems(pathname: string, isStaffOnly: boolean): BreadcrumbItem[] | undefined {
  const match = /^\/contracts\/([^/]+)\/workflow\/erection\/method-statement\/approval\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, contractId] = match;

  return buildErectionStepBreadcrumb(contractId!, 'Erection Method Statement Approval', isStaffOnly);
}

// CM-71D — same reasoning as contractErectionMethodStatementBreadcrumbItems
// above; Step 3 sits directly under .../workflow/erection/schedule (one
// level, not nested under method-statement like Step 2).
export function contractErectionScheduleBreadcrumbItems(pathname: string, isStaffOnly: boolean): BreadcrumbItem[] | undefined {
  const match = /^\/contracts\/([^/]+)\/workflow\/erection\/schedule\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, contractId] = match;

  return buildErectionStepBreadcrumb(contractId!, 'Issue Erection Schedule', isStaffOnly);
}

// CM-71E — same reasoning as contractErectionScheduleBreadcrumbItems above;
// Step 4 sits directly under .../workflow/erection/delivery-start.
export function contractErectionDeliveryStartBreadcrumbItems(pathname: string, isStaffOnly: boolean): BreadcrumbItem[] | undefined {
  const match = /^\/contracts\/([^/]+)\/workflow\/erection\/delivery-start\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, contractId] = match;

  return buildErectionStepBreadcrumb(contractId!, 'Delivery Start', isStaffOnly);
}

// CM-71F — same reasoning as contractErectionDeliveryStartBreadcrumbItems
// above; Step 5 sits directly under .../workflow/erection/start.
export function contractErectionStartBreadcrumbItems(pathname: string, isStaffOnly: boolean): BreadcrumbItem[] | undefined {
  const match = /^\/contracts\/([^/]+)\/workflow\/erection\/start\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, contractId] = match;

  return buildErectionStepBreadcrumb(contractId!, 'Erection Start', isStaffOnly);
}

// CM-71G — same reasoning as contractErectionStartBreadcrumbItems above;
// Step 6 sits directly under .../workflow/erection/checklist. Breadcrumb
// label is "Erection Checklist", per this unit's own explicit title —
// never "Issue Checklist" (that phrase is reserved for the action
// button/label context this unit's own task separately allows, not the
// breadcrumb) and never confused with the pre-existing Issue Log feature.
export function contractErectionChecklistBreadcrumbItems(pathname: string, isStaffOnly: boolean): BreadcrumbItem[] | undefined {
  const match = /^\/contracts\/([^/]+)\/workflow\/erection\/checklist\/?$/.exec(pathname);
  if (!match) return undefined;
  const [, contractId] = match;

  return buildErectionStepBreadcrumb(contractId!, 'Erection Checklist', isStaffOnly);
}
