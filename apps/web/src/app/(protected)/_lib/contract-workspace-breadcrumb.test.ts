import { describe, it, expect } from 'vitest';
import {
  isContractWorkspaceDetailPath,
  contractModuleBreadcrumbItems,
  contractWorkflowBreadcrumbItems,
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
