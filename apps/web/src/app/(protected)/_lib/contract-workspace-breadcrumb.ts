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
