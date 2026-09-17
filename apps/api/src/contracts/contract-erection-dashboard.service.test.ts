import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import {
  ContractErectionDashboardService,
  isErectionRelatedContract,
  computeMethodStatementDisplayStatus,
  computeMethodStatementApprovalDisplayStatus,
  computeScheduleDisplayStatus,
  computeDeliveryStartDisplayStatus,
  computeErectionStartDisplayStatus,
  computeChecklistDisplayStatus,
  computeErectionAttention,
  computeCurrentErectionStep,
  computeCurrentErectionStepLabel,
  computeErectionDashboardKpis,
  computeErectionNextAction,
  computeErectionViewerActionMode,
} from './contract-erection-dashboard.service';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import { DepartmentAccessService } from '../department-access/department-access.service';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('isErectionRelatedContract', () => {
  it('is true when scopeOfWork.erection is true, even with no other signal', () => {
    expect(isErectionRelatedContract({ scopeOfWork: { erection: true }, hasErectionMethodStatement: false, hasErectionWorkflowTask: false })).toBe(true);
  });

  it('is true when a CM-71A method statement already exists, even without the scope flag', () => {
    expect(isErectionRelatedContract({ scopeOfWork: { erection: false }, hasErectionMethodStatement: true, hasErectionWorkflowTask: false })).toBe(true);
  });

  it('is true when a real ERECTION-team workflow task exists (e.g. generated via delivery-only scope), even without the scope flag', () => {
    expect(isErectionRelatedContract({ scopeOfWork: { erection: false, delivery: true }, hasErectionMethodStatement: false, hasErectionWorkflowTask: true })).toBe(true);
  });

  it('is false when none of the 3 real signals are present', () => {
    expect(isErectionRelatedContract({ scopeOfWork: { production: true }, hasErectionMethodStatement: false, hasErectionWorkflowTask: false })).toBe(false);
  });

  it('is false for a null/undefined scopeOfWork with no other signal', () => {
    expect(isErectionRelatedContract({ scopeOfWork: null, hasErectionMethodStatement: false, hasErectionWorkflowTask: false })).toBe(false);
  });
});

describe('computeMethodStatementDisplayStatus', () => {
  it('returns NOT_STARTED for null/undefined (no record yet)', () => {
    expect(computeMethodStatementDisplayStatus(null)).toBe('NOT_STARTED');
    expect(computeMethodStatementDisplayStatus(undefined)).toBe('NOT_STARTED');
  });

  it('passes through each real stored status as-is', () => {
    expect(computeMethodStatementDisplayStatus('DRAFT')).toBe('DRAFT');
    expect(computeMethodStatementDisplayStatus('SUBMITTED_FOR_APPROVAL')).toBe('SUBMITTED_FOR_APPROVAL');
    expect(computeMethodStatementDisplayStatus('ISSUED')).toBe('ISSUED');
  });

  it('falls back to NOT_STARTED for an unrecognized value rather than throwing', () => {
    expect(computeMethodStatementDisplayStatus('SOMETHING_UNEXPECTED')).toBe('NOT_STARTED');
  });
});

describe('computeErectionAttention', () => {
  const today = '2026-09-20';

  it('is Overdue when Draft/Not Started and the planned issue date has passed', () => {
    expect(computeErectionAttention({ methodStatementStatus: 'DRAFT', plannedIssueDate: '2026-09-10', today })).toBe('OVERDUE');
    expect(computeErectionAttention({ methodStatementStatus: 'NOT_STARTED', plannedIssueDate: '2026-09-10', today })).toBe('OVERDUE');
  });

  it('is Awaiting Approval once submitted, regardless of date', () => {
    expect(computeErectionAttention({ methodStatementStatus: 'SUBMITTED_FOR_APPROVAL', plannedIssueDate: '2026-09-10', today })).toBe('AWAITING_APPROVAL');
  });

  it('is On Track once issued, regardless of date', () => {
    expect(computeErectionAttention({ methodStatementStatus: 'ISSUED', plannedIssueDate: null, today })).toBe('ON_TRACK');
  });

  it('is Needs Planning when Draft/Not Started with no planned issue date at all', () => {
    expect(computeErectionAttention({ methodStatementStatus: 'DRAFT', plannedIssueDate: null, today })).toBe('NEEDS_PLANNING');
    expect(computeErectionAttention({ methodStatementStatus: 'NOT_STARTED', plannedIssueDate: null, today })).toBe('NEEDS_PLANNING');
  });

  it('is Needs Planning (not Overdue) when Draft with a real planned date that has not arrived yet', () => {
    expect(computeErectionAttention({ methodStatementStatus: 'DRAFT', plannedIssueDate: '2026-12-01', today })).toBe('NEEDS_PLANNING');
  });
});

describe('computeCurrentErectionStep', () => {
  it('reads "Not Started" when there are no ERECTION workflow tasks at all', () => {
    expect(computeCurrentErectionStep([])).toBe('Not Started');
  });

  it('returns the first not-yet-COMPLETED task by sortOrder', () => {
    const tasks = [
      { taskKey: 'erection_method_statement_issued', taskName: 'Issued of Erection Method Statement', sortOrder: 1, status: 'COMPLETED', dueDate: null, responsibleUserId: null },
      { taskKey: 'erection_statement_approval', taskName: 'Erection Statement Approval', sortOrder: 2, status: 'IN_PROGRESS', dueDate: null, responsibleUserId: null },
      { taskKey: 'erection_schedule_issued', taskName: 'Issued Erection Schedule', sortOrder: 3, status: 'NOT_STARTED', dueDate: null, responsibleUserId: null },
    ];
    expect(computeCurrentErectionStep(tasks)).toBe('Erection Statement Approval');
  });

  it('is resilient to out-of-order input (sorts by sortOrder itself)', () => {
    const tasks = [
      { taskKey: 'b', taskName: 'Second', sortOrder: 2, status: 'NOT_STARTED', dueDate: null, responsibleUserId: null },
      { taskKey: 'a', taskName: 'First', sortOrder: 1, status: 'COMPLETED', dueDate: null, responsibleUserId: null },
    ];
    expect(computeCurrentErectionStep(tasks)).toBe('Second');
  });

  it('reads "All Steps Complete" once every real task is COMPLETED', () => {
    const tasks = [
      { taskKey: 'a', taskName: 'First', sortOrder: 1, status: 'COMPLETED', dueDate: null, responsibleUserId: null },
      { taskKey: 'b', taskName: 'Second', sortOrder: 2, status: 'COMPLETED', dueDate: null, responsibleUserId: null },
    ];
    expect(computeCurrentErectionStep(tasks)).toBe('All Steps Complete');
  });
});

describe('computeErectionDashboardKpis', () => {
  it('counts Method Statement Pending as NOT_STARTED + DRAFT combined', () => {
    const rows = [
      { methodStatementStatus: 'NOT_STARTED' as const, attention: 'NEEDS_PLANNING' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'NOT_STARTED' as const },
      { methodStatementStatus: 'DRAFT' as const, attention: 'NEEDS_PLANNING' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'NOT_STARTED' as const },
      { methodStatementStatus: 'ISSUED' as const, attention: 'ON_TRACK' as const, readyForErection: true, erectionInProgress: false, checklistStatus: 'NOT_STARTED' as const },
    ];
    const kpis = computeErectionDashboardKpis(rows);
    expect(kpis.totalErectionContracts).toBe(3);
    expect(kpis.methodStatementPending).toBe(2);
    expect(kpis.readyForErection).toBe(1);
  });

  it('never fabricates Payment counts — always a fixed false placeholder; Checklist Pending is a real count (CM-71G)', () => {
    const kpis = computeErectionDashboardKpis([]);
    expect(kpis.checklistPending).toBe(0);
    expect(kpis.paymentPendingAfterErectionAvailable).toBe(false);
    expect(kpis.totalErectionContracts).toBe(0);
  });

  it('counts Delayed / Attention Required from the attention field alone', () => {
    const rows = [
      { methodStatementStatus: 'DRAFT' as const, attention: 'OVERDUE' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'NOT_STARTED' as const },
      { methodStatementStatus: 'DRAFT' as const, attention: 'NEEDS_PLANNING' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'NOT_STARTED' as const },
    ];
    expect(computeErectionDashboardKpis(rows).delayedAttentionRequired).toBe(1);
  });

  it('counts Checklist Pending as DRAFT + SUBMITTED_FOR_VERIFICATION combined — never HOLD/RETURNED/NOT_STARTED/VERIFIED (CM-71G)', () => {
    const rows = [
      { methodStatementStatus: 'ISSUED' as const, attention: 'ON_TRACK' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'DRAFT' as const },
      { methodStatementStatus: 'ISSUED' as const, attention: 'ON_TRACK' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'SUBMITTED_FOR_VERIFICATION' as const },
      { methodStatementStatus: 'ISSUED' as const, attention: 'ON_TRACK' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'VERIFIED' as const },
      { methodStatementStatus: 'ISSUED' as const, attention: 'ON_TRACK' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'HOLD' as const },
      { methodStatementStatus: 'ISSUED' as const, attention: 'ON_TRACK' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'RETURNED' as const },
      { methodStatementStatus: 'ISSUED' as const, attention: 'ON_TRACK' as const, readyForErection: false, erectionInProgress: false, checklistStatus: 'NOT_STARTED' as const },
    ];
    expect(computeErectionDashboardKpis(rows).checklistPending).toBe(2);
  });
});

describe('computeMethodStatementApprovalDisplayStatus (CM-71C)', () => {
  it('returns NOT_STARTED for null/undefined (no approval row yet)', () => {
    expect(computeMethodStatementApprovalDisplayStatus(null)).toBe('NOT_STARTED');
    expect(computeMethodStatementApprovalDisplayStatus(undefined)).toBe('NOT_STARTED');
  });

  it('passes through each real stored reviewStatus as-is', () => {
    expect(computeMethodStatementApprovalDisplayStatus('PENDING_APPROVAL')).toBe('PENDING_APPROVAL');
    expect(computeMethodStatementApprovalDisplayStatus('DRAFT_REVIEW')).toBe('DRAFT_REVIEW');
    expect(computeMethodStatementApprovalDisplayStatus('APPROVED')).toBe('APPROVED');
    expect(computeMethodStatementApprovalDisplayStatus('REVISION_REQUESTED')).toBe('REVISION_REQUESTED');
    expect(computeMethodStatementApprovalDisplayStatus('REJECTED')).toBe('REJECTED');
  });

  it('falls back to NOT_STARTED for an unrecognized value rather than throwing', () => {
    expect(computeMethodStatementApprovalDisplayStatus('SOMETHING_UNEXPECTED')).toBe('NOT_STARTED');
  });
});

describe('computeScheduleDisplayStatus (CM-71D)', () => {
  it('returns NOT_STARTED for null/undefined (no record yet)', () => {
    expect(computeScheduleDisplayStatus(null)).toBe('NOT_STARTED');
    expect(computeScheduleDisplayStatus(undefined)).toBe('NOT_STARTED');
  });

  it('passes through each real stored status as-is', () => {
    expect(computeScheduleDisplayStatus('DRAFT')).toBe('DRAFT');
    expect(computeScheduleDisplayStatus('ISSUED')).toBe('ISSUED');
    expect(computeScheduleDisplayStatus('HOLD')).toBe('HOLD');
    expect(computeScheduleDisplayStatus('RETURNED')).toBe('RETURNED');
  });

  it('falls back to NOT_STARTED for an unrecognized value rather than throwing', () => {
    expect(computeScheduleDisplayStatus('SOMETHING_UNEXPECTED')).toBe('NOT_STARTED');
  });
});

describe('computeDeliveryStartDisplayStatus (CM-71E)', () => {
  it('returns NOT_STARTED for null/undefined (no record yet)', () => {
    expect(computeDeliveryStartDisplayStatus(null)).toBe('NOT_STARTED');
    expect(computeDeliveryStartDisplayStatus(undefined)).toBe('NOT_STARTED');
  });

  it('passes through each real stored status as-is', () => {
    expect(computeDeliveryStartDisplayStatus('DRAFT')).toBe('DRAFT');
    expect(computeDeliveryStartDisplayStatus('STARTED')).toBe('STARTED');
    expect(computeDeliveryStartDisplayStatus('HOLD')).toBe('HOLD');
    expect(computeDeliveryStartDisplayStatus('RETURNED')).toBe('RETURNED');
  });

  it('falls back to NOT_STARTED for an unrecognized value rather than throwing', () => {
    expect(computeDeliveryStartDisplayStatus('SOMETHING_UNEXPECTED')).toBe('NOT_STARTED');
  });
});

describe('computeErectionStartDisplayStatus (CM-71F)', () => {
  it('returns NOT_STARTED for null/undefined (no record yet)', () => {
    expect(computeErectionStartDisplayStatus(null)).toBe('NOT_STARTED');
    expect(computeErectionStartDisplayStatus(undefined)).toBe('NOT_STARTED');
  });

  it('passes through each real stored status as-is', () => {
    expect(computeErectionStartDisplayStatus('DRAFT')).toBe('DRAFT');
    expect(computeErectionStartDisplayStatus('STARTED')).toBe('STARTED');
    expect(computeErectionStartDisplayStatus('HOLD')).toBe('HOLD');
    expect(computeErectionStartDisplayStatus('RETURNED')).toBe('RETURNED');
  });

  it('falls back to NOT_STARTED for an unrecognized value rather than throwing', () => {
    expect(computeErectionStartDisplayStatus('SOMETHING_UNEXPECTED')).toBe('NOT_STARTED');
  });
});

describe('computeChecklistDisplayStatus (CM-71G)', () => {
  it('returns NOT_STARTED for null/undefined (no record yet)', () => {
    expect(computeChecklistDisplayStatus(null)).toBe('NOT_STARTED');
    expect(computeChecklistDisplayStatus(undefined)).toBe('NOT_STARTED');
  });

  it('passes through each real stored status as-is', () => {
    expect(computeChecklistDisplayStatus('DRAFT')).toBe('DRAFT');
    expect(computeChecklistDisplayStatus('SUBMITTED_FOR_VERIFICATION')).toBe('SUBMITTED_FOR_VERIFICATION');
    expect(computeChecklistDisplayStatus('VERIFIED')).toBe('VERIFIED');
    expect(computeChecklistDisplayStatus('HOLD')).toBe('HOLD');
    expect(computeChecklistDisplayStatus('RETURNED')).toBe('RETURNED');
  });

  it('falls back to NOT_STARTED for an unrecognized value rather than throwing', () => {
    expect(computeChecklistDisplayStatus('SOMETHING_UNEXPECTED')).toBe('NOT_STARTED');
  });
});

describe('computeErectionNextAction (CM-71C / CM-71D / CM-71E / CM-71F / CM-71G)', () => {
  const base = {
    contractId: 'c1',
    hasMethodStatement: false,
    approvalStatus: 'NOT_STARTED' as const,
    scheduleStatus: 'NOT_STARTED' as const,
    hasSchedule: false,
    deliveryStartStatus: 'NOT_STARTED' as const,
    hasDeliveryStart: false,
    erectionStartStatus: 'NOT_STARTED' as const,
    hasErectionStart: false,
    checklistStatus: 'NOT_STARTED' as const,
    hasChecklist: false,
  };

  it('points to Step 1 (Start) when no method statement exists yet', () => {
    const action = computeErectionNextAction({ ...base, methodStatementStatus: 'NOT_STARTED' });
    expect(action).toEqual({ label: 'Start Method Statement', href: '/contracts/c1/workflow/erection/method-statement' });
  });

  it('points to Step 1 (View/Continue) when a Draft method statement exists', () => {
    const action = computeErectionNextAction({ ...base, hasMethodStatement: true, methodStatementStatus: 'DRAFT' });
    expect(action).toEqual({ label: 'View / Continue', href: '/contracts/c1/workflow/erection/method-statement' });
  });

  it('points to Step 2 (Start Review) once Submitted for Approval and no review has begun', () => {
    const action = computeErectionNextAction({ ...base, hasMethodStatement: true, methodStatementStatus: 'SUBMITTED_FOR_APPROVAL' });
    expect(action).toEqual({ label: 'Start Review', href: '/contracts/c1/workflow/erection/method-statement/approval' });
  });

  it('points to Step 2 (Start Review) once Issued and no review has begun', () => {
    const action = computeErectionNextAction({ ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED' });
    expect(action).toEqual({ label: 'Start Review', href: '/contracts/c1/workflow/erection/method-statement/approval' });
  });

  it('points to Step 2 (View/Continue Review) once a review is already in progress', () => {
    const action = computeErectionNextAction({
      ...base, methodStatementStatus: 'ISSUED', approvalStatus: 'DRAFT_REVIEW', hasMethodStatement: true,
    });
    expect(action).toEqual({ label: 'View / Continue Review', href: '/contracts/c1/workflow/erection/method-statement/approval' });
  });

  it('points to Step 3 (Issue Erection Schedule) once Step 2 is Approved and no schedule exists yet', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
    });
    expect(action).toEqual({ label: 'Issue Erection Schedule', href: '/contracts/c1/workflow/erection/schedule' });
  });

  it('points to Step 3 (View/Continue Schedule) once Step 2 is Approved and a Draft schedule already exists', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'DRAFT', hasSchedule: true,
    });
    expect(action).toEqual({ label: 'View / Continue Schedule', href: '/contracts/c1/workflow/erection/schedule' });
  });

  it('points to Step 4 (Delivery Start) once the schedule has been Issued and no delivery-start record exists yet', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true,
    });
    expect(action).toEqual({ label: 'Delivery Start', href: '/contracts/c1/workflow/erection/delivery-start' });
  });

  it('points to Step 4 (View/Continue Delivery Start) once a Draft delivery-start record already exists', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true, deliveryStartStatus: 'DRAFT', hasDeliveryStart: true,
    });
    expect(action).toEqual({ label: 'View / Continue Delivery Start', href: '/contracts/c1/workflow/erection/delivery-start' });
  });

  it('points to Step 5 (Erection Start) once delivery has been Started and no erection-start record exists yet', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true, deliveryStartStatus: 'STARTED', hasDeliveryStart: true,
    });
    expect(action).toEqual({ label: 'Erection Start', href: '/contracts/c1/workflow/erection/start' });
  });

  it('points to Step 5 (View/Continue Erection Start) once a Draft erection-start record already exists', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true, deliveryStartStatus: 'STARTED', hasDeliveryStart: true,
      erectionStartStatus: 'DRAFT', hasErectionStart: true,
    });
    expect(action).toEqual({ label: 'View / Continue Erection Start', href: '/contracts/c1/workflow/erection/start' });
  });

  it('points to Step 5 (View Erection Start) once erection has been Started and Step 6 does not exist yet', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true, deliveryStartStatus: 'STARTED', hasDeliveryStart: true,
      erectionStartStatus: 'STARTED', hasErectionStart: true,
    });
    expect(action).toEqual({ label: 'Erection Checklist', href: '/contracts/c1/workflow/erection/checklist' });
  });

  it('points to Step 6 (View/Continue Checklist) once a Draft checklist already exists', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true, deliveryStartStatus: 'STARTED', hasDeliveryStart: true,
      erectionStartStatus: 'STARTED', hasErectionStart: true, checklistStatus: 'DRAFT', hasChecklist: true,
    });
    expect(action).toEqual({ label: 'View / Continue Checklist', href: '/contracts/c1/workflow/erection/checklist' });
  });

  it('points to Step 6 (View Checklist) once the checklist has been Submitted for Verification', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true, deliveryStartStatus: 'STARTED', hasDeliveryStart: true,
      erectionStartStatus: 'STARTED', hasErectionStart: true, checklistStatus: 'SUBMITTED_FOR_VERIFICATION', hasChecklist: true,
    });
    expect(action).toEqual({ label: 'View Checklist', href: '/contracts/c1/workflow/erection/checklist' });
  });

  it('points to Step 6 (View Checklist) once the checklist has been Verified', () => {
    const action = computeErectionNextAction({
      ...base, hasMethodStatement: true, methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED',
      scheduleStatus: 'ISSUED', hasSchedule: true, deliveryStartStatus: 'STARTED', hasDeliveryStart: true,
      erectionStartStatus: 'STARTED', hasErectionStart: true, checklistStatus: 'VERIFIED', hasChecklist: true,
    });
    expect(action).toEqual({ label: 'View Checklist', href: '/contracts/c1/workflow/erection/checklist' });
  });
});

describe('computeCurrentErectionStepLabel (CM-71D / CM-71E / CM-71F / CM-71G)', () => {
  it('shows Step 1 label when the method statement has not been started or is still Draft', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'NOT_STARTED', approvalStatus: 'NOT_STARTED', scheduleStatus: 'NOT_STARTED', deliveryStartStatus: 'NOT_STARTED', erectionStartStatus: 'NOT_STARTED', checklistStatus: 'NOT_STARTED',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Issue Erection Method Statement');
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'DRAFT', approvalStatus: 'NOT_STARTED', scheduleStatus: 'NOT_STARTED', deliveryStartStatus: 'NOT_STARTED', erectionStartStatus: 'NOT_STARTED', checklistStatus: 'NOT_STARTED',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Issue Erection Method Statement');
  });

  it('shows Step 2 label once the method statement is issued but approval is not yet Approved', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'DRAFT_REVIEW', scheduleStatus: 'NOT_STARTED', deliveryStartStatus: 'NOT_STARTED', erectionStartStatus: 'NOT_STARTED', checklistStatus: 'NOT_STARTED',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Erection Method Statement Approval');
  });

  it('shows Step 3 label once approval is Approved but the schedule is not yet Issued', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'DRAFT', deliveryStartStatus: 'NOT_STARTED', erectionStartStatus: 'NOT_STARTED', checklistStatus: 'NOT_STARTED',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Issue Erection Schedule');
  });

  it('shows Step 4 label once the schedule has been Issued but delivery is not yet Started', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'DRAFT', erectionStartStatus: 'NOT_STARTED', checklistStatus: 'NOT_STARTED',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Delivery Start');
  });

  it('shows Step 5 label once delivery has been Started but erection is not yet Started', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'STARTED', erectionStartStatus: 'DRAFT', checklistStatus: 'NOT_STARTED',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Erection Start');
  });

  it('shows Step 6 label once erection has been Started but the checklist is not yet submitted/verified', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'DRAFT',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Erection Checklist');
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'HOLD',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Erection Checklist');
  });

  it('falls back to the generic task-derived label once the checklist has been Submitted for Verification (Step 7 not yet built)', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'SUBMITTED_FOR_VERIFICATION',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Some Generic Task');
  });

  it('falls back to the generic task-derived label once the checklist has been Verified', () => {
    expect(
      computeCurrentErectionStepLabel({
        methodStatementStatus: 'ISSUED', approvalStatus: 'APPROVED', scheduleStatus: 'ISSUED', deliveryStartStatus: 'STARTED', erectionStartStatus: 'STARTED', checklistStatus: 'VERIFIED',
        genericTaskFallback: 'Some Generic Task',
      }),
    ).toBe('Some Generic Task');
  });
});

describe('computeErectionViewerActionMode (CM-71H)', () => {
  it('is ACT when the assignment belongs to the current viewer', () => {
    expect(computeErectionViewerActionMode({ hasAssignment: true, isAssignedToActor: true, actorCanManage: false })).toBe('ACT');
    expect(computeErectionViewerActionMode({ hasAssignment: true, isAssignedToActor: true, actorCanManage: true })).toBe('ACT');
  });

  it('is ACT for a manager-tier actor when nobody is assigned yet (someone has to be able to start/assign)', () => {
    expect(computeErectionViewerActionMode({ hasAssignment: false, isAssignedToActor: false, actorCanManage: true })).toBe('ACT');
  });

  it('is MONITOR for a manager-tier actor when the contract is assigned to someone else', () => {
    expect(computeErectionViewerActionMode({ hasAssignment: true, isAssignedToActor: false, actorCanManage: true })).toBe('MONITOR');
  });

  it('is READ_ONLY for a non-manager actor who is not the assignee (including when nothing is assigned yet)', () => {
    expect(computeErectionViewerActionMode({ hasAssignment: true, isAssignedToActor: false, actorCanManage: false })).toBe('READ_ONLY');
    expect(computeErectionViewerActionMode({ hasAssignment: false, isAssignedToActor: false, actorCanManage: false })).toBe('READ_ONLY');
  });
});

// ---------------------------------------------------------------------------
// Service-level tests (permission gate + a minimal happy path)
// ---------------------------------------------------------------------------

const mockContractFindMany = vi.fn();
const mockActivityFindMany = vi.fn();

const mockClient = {
  contract: { findMany: mockContractFindMany },
  contractActivity: { findMany: mockActivityFindMany },
};

const mockDb = { getClient: () => mockClient } as unknown as DatabaseService;

function actor(permissions: string[]): AuthUser {
  return { id: 'user-1', displayName: 'Test User', permissions } as AuthUser;
}

describe('ContractErectionDashboardService', () => {
  let deptAccess: DepartmentAccessService;
  let service: ContractErectionDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    deptAccess = { buildDeptFilter: vi.fn().mockResolvedValue(null) } as unknown as DepartmentAccessService;
    service = new ContractErectionDashboardService(mockDb, deptAccess);
  });

  it('rejects an actor without contracts.read', async () => {
    await expect(service.getDashboard(actor([]))).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockContractFindMany).not.toHaveBeenCalled();
  });

  it('excludes a non-erection contract from the work queue and KPIs', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'c1', referenceNumber: 'CT-001', title: 'Not Erection', counterpartyName: 'Client A', jobOrder: null,
        status: 'ACTIVE', endDate: null, renewalNoticeDate: null, scopeOfWork: { production: true }, updatedAt: new Date('2026-01-01'),
        erectionMethodStatement: null, workflowTasks: [],
      },
    ]);
    mockActivityFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(actor(['contracts.read']));
    expect(result.workQueue).toHaveLength(0);
    expect(result.kpis.totalErectionContracts).toBe(0);
  });

  it('includes an erection-scoped contract with no method statement yet as Not Started (manager-tier actor, sees all)', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'c2', referenceNumber: 'CONTRACT-2026-000004', title: 'GRM Boundary Wall & Yard Upgrade', counterpartyName: 'Gulf Ready Mix Co.',
        jobOrder: null, status: 'ACTIVE', endDate: null, renewalNoticeDate: null, scopeOfWork: { erection: true }, updatedAt: new Date('2026-01-01'),
        erectionMethodStatement: null, workflowTasks: [], erectionWorkflowAssignment: null,
      },
    ]);
    mockActivityFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(actor(['contracts.read', 'contracts.update']));
    expect(result.workQueue).toHaveLength(1);
    expect(result.workQueue[0]?.methodStatementStatus).toBe('NOT_STARTED');
    expect(result.workQueue[0]?.hasMethodStatement).toBe(false);
    expect(result.kpis.methodStatementPending).toBe(1);
    // CM-71H — nobody assigned yet, but a manager-tier actor can still act (start/assign).
    expect(result.workQueue[0]?.viewerActionMode).toBe('ACT');
  });

  // -------------------------------------------------------------------------
  // CM-71H — Erection Workflow Assignment dashboard filtering
  // -------------------------------------------------------------------------

  const CONTRACT_ASSIGNED_TO_EM = {
    id: 'c3', referenceNumber: 'CONTRACT-2026-000005', title: 'Assigned To EM', counterpartyName: 'Client B',
    jobOrder: null, status: 'ACTIVE', endDate: null, renewalNoticeDate: null, scopeOfWork: { erection: true }, updatedAt: new Date('2026-01-01'),
    erectionMethodStatement: null, workflowTasks: [],
    erectionWorkflowAssignment: { assignedToUserId: 'em-1', assignedToName: null, assignedDepartment: 'Erection Department', status: 'ASSIGNED' },
  };
  const CONTRACT_ASSIGNED_TO_SOMEONE_ELSE = {
    id: 'c4', referenceNumber: 'CONTRACT-2026-000006', title: 'Assigned To Someone Else', counterpartyName: 'Client C',
    jobOrder: null, status: 'ACTIVE', endDate: null, renewalNoticeDate: null, scopeOfWork: { erection: true }, updatedAt: new Date('2026-01-01'),
    erectionMethodStatement: null, workflowTasks: [],
    erectionWorkflowAssignment: { assignedToUserId: 'em-2', assignedToName: null, assignedDepartment: 'Erection Department', status: 'ASSIGNED' },
  };

  it('shows a non-manager-tier actor only contracts assigned to them (Erection Manager view)', async () => {
    mockContractFindMany.mockResolvedValue([CONTRACT_ASSIGNED_TO_EM, CONTRACT_ASSIGNED_TO_SOMEONE_ELSE]);
    mockActivityFindMany.mockResolvedValue([]);

    const emActor = { id: 'em-1', displayName: 'Erection Manager', permissions: ['contracts.read', 'contracts.workflow_update'] } as AuthUser;
    const result = await service.getDashboard(emActor);
    expect(result.workQueue.map((r) => r.contractId)).toEqual(['c3']);
    expect(result.workQueue[0]?.viewerActionMode).toBe('ACT');
  });

  it('shows a manager-tier actor every erection contract regardless of assignment, in MONITOR mode when assigned to someone else', async () => {
    mockContractFindMany.mockResolvedValue([CONTRACT_ASSIGNED_TO_EM, CONTRACT_ASSIGNED_TO_SOMEONE_ELSE]);
    mockActivityFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(actor(['contracts.read', 'contracts.update']));
    expect(result.workQueue.map((r) => r.contractId).sort()).toEqual(['c3', 'c4']);
    expect(result.workQueue.every((r) => r.viewerActionMode === 'MONITOR')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CM-71H.4 — task-level assignment (responsibleUserId) is an equally real
  // fallback signal for a non-manager actor, alongside (never instead of) a
  // real ContractErectionWorkflowAssignment row — no duplicate assignment
  // is required for a contract to show up correctly.
  // -------------------------------------------------------------------------

  const CONTRACT_ASSIGNED_VIA_TASK_ONLY = {
    id: 'c5', referenceNumber: 'CONTRACT-2026-000009', title: 'GRM Boundary Wall & Yard Upgrade', counterpartyName: 'Gulf Ready Mix Co.',
    jobOrder: null, status: 'ACTIVE', endDate: null, renewalNoticeDate: null, scopeOfWork: { erection: true }, updatedAt: new Date('2026-01-01'),
    erectionMethodStatement: null,
    workflowTasks: [
      { taskKey: 'erection_method_statement_issued', taskName: 'Issue Erection Method Statement', sortOrder: 1, status: 'NOT_STARTED', dueDate: null, responsibleUserId: 'em-1' },
    ],
    erectionWorkflowAssignment: null,
  };

  it('shows a non-manager-tier actor a contract they only have a task-level assignment on — no ContractErectionWorkflowAssignment row required', async () => {
    mockContractFindMany.mockResolvedValue([CONTRACT_ASSIGNED_VIA_TASK_ONLY]);
    mockActivityFindMany.mockResolvedValue([]);

    const emActor = { id: 'em-1', displayName: 'Erection Manager', permissions: ['contracts.read', 'contracts.workflow_update'] } as AuthUser;
    const result = await service.getDashboard(emActor);
    expect(result.workQueue.map((r) => r.contractId)).toEqual(['c5']);
    expect(result.workQueue[0]?.viewerActionMode).toBe('ACT');
    expect(result.workQueue[0]?.assignmentSource).toBe('TASK_ASSIGNMENT_ONLY');
  });

  it('does not show a task-assigned-only contract to a DIFFERENT non-manager actor', async () => {
    mockContractFindMany.mockResolvedValue([CONTRACT_ASSIGNED_VIA_TASK_ONLY]);
    mockActivityFindMany.mockResolvedValue([]);

    const otherActor = { id: 'em-2', displayName: 'Someone Else', permissions: ['contracts.read', 'contracts.workflow_update'] } as AuthUser;
    const result = await service.getDashboard(otherActor);
    expect(result.workQueue).toHaveLength(0);
  });

  it('reports assignmentSource WORKFLOW_ASSIGNMENT when a real assignment row exists, even if task-level assignment also exists', async () => {
    mockContractFindMany.mockResolvedValue([{
      ...CONTRACT_ASSIGNED_VIA_TASK_ONLY,
      erectionWorkflowAssignment: { assignedToUserId: 'em-1', assignedToName: null, assignedDepartment: 'Erection Department', status: 'ASSIGNED' },
    }]);
    mockActivityFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(actor(['contracts.read', 'contracts.update']));
    expect(result.workQueue[0]?.assignmentSource).toBe('WORKFLOW_ASSIGNMENT');
  });

  it('reports assignmentSource NONE when neither signal exists', async () => {
    mockContractFindMany.mockResolvedValue([{
      ...CONTRACT_ASSIGNED_VIA_TASK_ONLY,
      id: 'c6',
      workflowTasks: [{ ...CONTRACT_ASSIGNED_VIA_TASK_ONLY.workflowTasks[0]!, responsibleUserId: null }],
      erectionWorkflowAssignment: null,
    }]);
    mockActivityFindMany.mockResolvedValue([]);

    const result = await service.getDashboard(actor(['contracts.read', 'contracts.update']));
    expect(result.workQueue[0]?.assignmentSource).toBe('NONE');
  });
});
