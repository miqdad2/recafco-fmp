import { describe, it, expect } from 'vitest';
import {
  isContractWorkspaceDetailPath,
  contractModuleBreadcrumbItems,
  contractWorkflowBreadcrumbItems,
  contractErectionMethodStatementBreadcrumbItems,
  contractErectionMethodStatementApprovalBreadcrumbItems,
  contractErectionScheduleBreadcrumbItems,
  contractErectionDeliveryStartBreadcrumbItems,
  contractErectionStartBreadcrumbItems,
  contractErectionChecklistBreadcrumbItems,
} from './contract-workspace-breadcrumb';

const CONTRACT_ID = '00000000-0000-0000-0000-000000000000';

describe('isContractWorkspaceDetailPath', () => {
  it('is true for the contract Overview page', () => {
    expect(isContractWorkspaceDetailPath(`/contracts/${CONTRACT_ID}`)).toBe(true);
  });

  it.each([
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
  ])('is true for the contract %s tab', (tab) => {
    expect(isContractWorkspaceDetailPath(`/contracts/${CONTRACT_ID}/${tab}`)).toBe(true);
  });

  it('is false for /contracts/[id]/edit — it lives outside the (workspace) route group', () => {
    expect(isContractWorkspaceDetailPath(`/contracts/${CONTRACT_ID}/edit`)).toBe(false);
  });

  it('is false for the bare Contract List page', () => {
    expect(isContractWorkspaceDetailPath('/contracts')).toBe(false);
  });

  it.each([
    'dashboard',
    'new',
    'workflow',
    'schedule',
    'payments',
    'issues',
    'claims',
    'closeouts',
    'erection-dashboard',
  ])('is false for the %s module page', (segment) => {
    expect(isContractWorkspaceDetailPath(`/contracts/${segment}`)).toBe(false);
  });

  it('is false for an unrelated route', () => {
    expect(isContractWorkspaceDetailPath('/incidents/dashboard')).toBe(false);
  });

  it('is false for the app root', () => {
    expect(isContractWorkspaceDetailPath('/')).toBe(false);
  });
});

describe('contractModuleBreadcrumbItems', () => {
  it('returns the real breadcrumb for the Dashboard page', () => {
    expect(contractModuleBreadcrumbItems('/contracts/dashboard')).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Dashboard' },
    ]);
  });

  it('returns the real breadcrumb for the bare Contract List page', () => {
    expect(contractModuleBreadcrumbItems('/contracts')).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List' },
    ]);
  });

  it('returns the real 3-item breadcrumb for New Contract Register', () => {
    expect(contractModuleBreadcrumbItems('/contracts/new')).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List', href: '/contracts' },
      { label: 'New Contract Register' },
    ]);
  });

  it.each([
    ['/contracts/schedule', 'Schedule'],
    ['/contracts/payments', 'Payments'],
    ['/contracts/issues', 'Issue Log'],
    ['/contracts/claims', 'Claim Log'],
    ['/contracts/closeouts', 'Closeout Requests'],
    ['/contracts/erection-dashboard', 'Erection Dashboard'],
  ])('returns the real breadcrumb for %s', (path, label) => {
    expect(contractModuleBreadcrumbItems(path)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label },
    ]);
  });

  it('is undefined for /contracts/workflow — it has 3 query-param-dependent breadcrumb variants handled in the page itself, not here', () => {
    expect(contractModuleBreadcrumbItems('/contracts/workflow')).toBeUndefined();
  });

  it('is undefined for a contract detail workspace page (handled by isContractWorkspaceDetailPath instead)', () => {
    expect(contractModuleBreadcrumbItems('/contracts/00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });

  it('is undefined for /contracts/[id]/edit', () => {
    expect(contractModuleBreadcrumbItems('/contracts/00000000-0000-0000-0000-000000000000/edit')).toBeUndefined();
  });

  it('is undefined for an unrelated route', () => {
    expect(contractModuleBreadcrumbItems('/incidents/dashboard')).toBeUndefined();
  });
});

describe('contractWorkflowBreadcrumbItems', () => {
  it('is undefined for a non-workflow pathname', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/payments', new URLSearchParams(), false)).toBeUndefined();
  });

  it('returns the plain "Contract Work Progress" breadcrumb with no mode param', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams(), false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract Work Progress' },
    ]);
  });

  it('returns the plain breadcrumb for a manager on ?mode=my-tasks (isStaffOnly false — only staff get the My Tasks variant)', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('mode=my-tasks'), false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract Work Progress' },
    ]);
  });

  it('returns the Assign Work breadcrumb under ?mode=assignment', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('mode=assignment'), false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract Work Progress', href: '/contracts/workflow' },
      { label: 'Assign Work' },
    ]);
  });

  it('returns the Assign Work breadcrumb under the assignmentOnly=true alias', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('assignmentOnly=true'), false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract Work Progress', href: '/contracts/workflow' },
      { label: 'Assign Work' },
    ]);
  });

  it('returns the My Tasks breadcrumb for a staff-only user on ?mode=my-tasks', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('mode=my-tasks'), true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks' },
    ]);
  });

  it('returns the Overdue Tasks breadcrumb for a staff-only user on ?mode=overdue', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('mode=overdue'), true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Overdue Tasks' },
    ]);
  });

  it('returns the Overdue Tasks breadcrumb for a staff-only user on the overdueOnly=true alias', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('overdueOnly=true'), true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Overdue Tasks' },
    ]);
  });

  it('returns the My Tasks breadcrumb for a staff-only user on the myTasksOnly=true alias', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('myTasksOnly=true'), true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks' },
    ]);
  });

  it('prefers Assign Work over My Tasks when both mode params are somehow present', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('mode=assignment&myTasksOnly=true'), true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract Work Progress', href: '/contracts/workflow' },
      { label: 'Assign Work' },
    ]);
  });

  it('prefers Overdue Tasks over My Tasks when both overdue and my-tasks are somehow present', () => {
    expect(contractWorkflowBreadcrumbItems('/contracts/workflow', new URLSearchParams('mode=overdue&myTasksOnly=true'), true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Overdue Tasks' },
    ]);
  });
});

describe('contractErectionMethodStatementBreadcrumbItems (CM-71A)', () => {
  it('returns the full 5-level breadcrumb for a manager-tier viewer, with real contractId-derived hrefs', () => {
    expect(contractErectionMethodStatementBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement`, false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List', href: '/contracts' },
      { label: 'Contract Detail', href: `/contracts/${CONTRACT_ID}` },
      { label: 'Workflow & Team Tasks', href: `/contracts/${CONTRACT_ID}/workflow` },
      { label: 'Issue Erection Method Statement' },
    ]);
  });

  // CM-71H.6 — a staff-tier (Erection Manager / Contract Staff) viewer
  // never sees the manager-only Contract Detail/Workflow & Team Tasks
  // chain — the focused erection view has no such tabs to link to.
  it('returns the shorter 3-level breadcrumb for a staff-tier viewer', () => {
    expect(contractErectionMethodStatementBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement`, true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' },
      { label: 'Issue Erection Method Statement' },
    ]);
  });

  it('tolerates a trailing slash', () => {
    expect(contractErectionMethodStatementBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement/`, false)).toBeDefined();
  });

  it('returns undefined for the plain Workflow tab (a shorter, different route)', () => {
    expect(contractErectionMethodStatementBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow`, false)).toBeUndefined();
  });

  it('returns undefined for an unrelated contract detail tab', () => {
    expect(contractErectionMethodStatementBreadcrumbItems(`/contracts/${CONTRACT_ID}/variations`, false)).toBeUndefined();
  });

  it('returns undefined for a future, not-yet-built erection step route (only Step 1 has this exact shape)', () => {
    expect(contractErectionMethodStatementBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/schedule`, false)).toBeUndefined();
  });
});

describe('contractErectionMethodStatementApprovalBreadcrumbItems (CM-71C)', () => {
  it('returns the full 5-level breadcrumb for a manager-tier viewer, with real contractId-derived hrefs', () => {
    expect(contractErectionMethodStatementApprovalBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement/approval`, false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List', href: '/contracts' },
      { label: 'Contract Detail', href: `/contracts/${CONTRACT_ID}` },
      { label: 'Workflow & Team Tasks', href: `/contracts/${CONTRACT_ID}/workflow` },
      { label: 'Erection Method Statement Approval' },
    ]);
  });

  it('returns the shorter 3-level breadcrumb for a staff-tier viewer', () => {
    expect(contractErectionMethodStatementApprovalBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement/approval`, true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' },
      { label: 'Erection Method Statement Approval' },
    ]);
  });

  it('tolerates a trailing slash', () => {
    expect(contractErectionMethodStatementApprovalBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement/approval/`, false)).toBeDefined();
  });

  it('returns undefined for Step 1 (a different, one-level-shallower route)', () => {
    expect(contractErectionMethodStatementApprovalBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement`, false)).toBeUndefined();
  });
});

describe('contractErectionScheduleBreadcrumbItems (CM-71D)', () => {
  it('returns the full 5-level breadcrumb for a manager-tier viewer, with real contractId-derived hrefs', () => {
    expect(contractErectionScheduleBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/schedule`, false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List', href: '/contracts' },
      { label: 'Contract Detail', href: `/contracts/${CONTRACT_ID}` },
      { label: 'Workflow & Team Tasks', href: `/contracts/${CONTRACT_ID}/workflow` },
      { label: 'Issue Erection Schedule' },
    ]);
  });

  it('returns the shorter 3-level breadcrumb for a staff-tier viewer', () => {
    expect(contractErectionScheduleBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/schedule`, true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' },
      { label: 'Issue Erection Schedule' },
    ]);
  });

  it('tolerates a trailing slash', () => {
    expect(contractErectionScheduleBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/schedule/`, false)).toBeDefined();
  });

  it('returns undefined for the plain Workflow tab (a shorter, different route)', () => {
    expect(contractErectionScheduleBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow`, false)).toBeUndefined();
  });

  it('returns undefined for Step 1 (a different, one-level-deeper route)', () => {
    expect(contractErectionScheduleBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement`, false)).toBeUndefined();
  });

  it('returns undefined for Step 2 (a different, sibling route)', () => {
    expect(contractErectionScheduleBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/method-statement/approval`, false)).toBeUndefined();
  });
});

describe('contractErectionDeliveryStartBreadcrumbItems (CM-71E)', () => {
  it('returns the full 5-level breadcrumb for a manager-tier viewer, with real contractId-derived hrefs', () => {
    expect(contractErectionDeliveryStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/delivery-start`, false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List', href: '/contracts' },
      { label: 'Contract Detail', href: `/contracts/${CONTRACT_ID}` },
      { label: 'Workflow & Team Tasks', href: `/contracts/${CONTRACT_ID}/workflow` },
      { label: 'Delivery Start' },
    ]);
  });

  it('returns the shorter 3-level breadcrumb for a staff-tier viewer', () => {
    expect(contractErectionDeliveryStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/delivery-start`, true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' },
      { label: 'Delivery Start' },
    ]);
  });

  it('tolerates a trailing slash', () => {
    expect(contractErectionDeliveryStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/delivery-start/`, false)).toBeDefined();
  });

  it('returns undefined for the plain Workflow tab (a shorter, different route)', () => {
    expect(contractErectionDeliveryStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow`, false)).toBeUndefined();
  });

  it('returns undefined for Step 3 (a different, sibling route)', () => {
    expect(contractErectionDeliveryStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/schedule`, false)).toBeUndefined();
  });
});

describe('contractErectionStartBreadcrumbItems (CM-71F)', () => {
  it('returns the full 5-level breadcrumb for a manager-tier viewer, with real contractId-derived hrefs', () => {
    expect(contractErectionStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/start`, false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List', href: '/contracts' },
      { label: 'Contract Detail', href: `/contracts/${CONTRACT_ID}` },
      { label: 'Workflow & Team Tasks', href: `/contracts/${CONTRACT_ID}/workflow` },
      { label: 'Erection Start' },
    ]);
  });

  it('returns the shorter 3-level breadcrumb for a staff-tier viewer', () => {
    expect(contractErectionStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/start`, true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' },
      { label: 'Erection Start' },
    ]);
  });

  it('tolerates a trailing slash', () => {
    expect(contractErectionStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/start/`, false)).toBeDefined();
  });

  it('returns undefined for the plain Workflow tab (a shorter, different route)', () => {
    expect(contractErectionStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow`, false)).toBeUndefined();
  });

  it('returns undefined for Step 4 (a different, sibling route)', () => {
    expect(contractErectionStartBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/delivery-start`, false)).toBeUndefined();
  });
});

describe('contractErectionChecklistBreadcrumbItems (CM-71G)', () => {
  it('returns the full 5-level breadcrumb for a manager-tier viewer, with real contractId-derived hrefs', () => {
    expect(contractErectionChecklistBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/checklist`, false)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'Contract List', href: '/contracts' },
      { label: 'Contract Detail', href: `/contracts/${CONTRACT_ID}` },
      { label: 'Workflow & Team Tasks', href: `/contracts/${CONTRACT_ID}/workflow` },
      { label: 'Erection Checklist' },
    ]);
  });

  it('returns the shorter 3-level breadcrumb for a staff-tier viewer', () => {
    expect(contractErectionChecklistBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/checklist`, true)).toEqual([
      { label: 'Contract Management', href: '/contracts/dashboard' },
      { label: 'My Tasks', href: '/contracts/workflow?mode=my-tasks' },
      { label: 'Erection Checklist' },
    ]);
  });

  it('tolerates a trailing slash', () => {
    expect(contractErectionChecklistBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/checklist/`, false)).toBeDefined();
  });

  it('returns undefined for the plain Workflow tab (a shorter, different route)', () => {
    expect(contractErectionChecklistBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow`, false)).toBeUndefined();
  });

  it('returns undefined for Step 5 (a different, sibling route)', () => {
    expect(contractErectionChecklistBreadcrumbItems(`/contracts/${CONTRACT_ID}/workflow/erection/start`, false)).toBeUndefined();
  });
});
