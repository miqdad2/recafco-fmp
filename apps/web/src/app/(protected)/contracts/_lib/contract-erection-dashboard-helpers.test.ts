import { describe, it, expect } from 'vitest';
import {
  ERECTION_METHOD_STATEMENT_DISPLAY_LABELS,
  ERECTION_SCHEDULE_DISPLAY_LABELS,
  ERECTION_DELIVERY_START_DISPLAY_LABELS,
  ERECTION_START_DISPLAY_LABELS,
  ERECTION_CHECKLIST_DISPLAY_LABELS,
  ERECTION_ATTENTION_LABELS,
  DEFAULT_ERECTION_WORK_QUEUE_FILTERS,
  matchesErectionWorkQueueFilters,
} from './contract-erection-dashboard-helpers';
import type { ErectionWorkQueueRow } from '@/lib/contracts-api';

const BASE_ROW: ErectionWorkQueueRow = {
  contractId: 'c1',
  contractReference: 'CONTRACT-2026-000004',
  jobOrderNo: 'JO-004/26',
  projectName: 'GRM Boundary Wall & Yard Upgrade',
  client: 'Gulf Ready Mix Co.',
  contractStatus: 'ACTIVE',
  lifecycleStatus: 'ACTIVE',
  methodStatementStatus: 'DRAFT',
  approvalStatus: 'NOT_STARTED',
  scheduleStatus: 'NOT_STARTED',
  plannedIssueDate: '2026-09-18',
  scheduleStartDate: null,
  scheduleEndDate: null,
  deliveryStartStatus: 'NOT_STARTED',
  deliveryWindowStart: null,
  deliveryWindowEnd: null,
  erectionStartStatus: 'NOT_STARTED',
  actualStartDateTime: null,
  checklistStatus: 'NOT_STARTED',
  workLocationYard: 'Site - Boundary Wall Zone A',
  responsibleTeam: 'Contracts Department',
  currentErectionStep: 'Erection Statement Approval',
  attention: 'NEEDS_PLANNING',
  lastUpdated: '2026-09-13T00:00:00.000Z',
  hasMethodStatement: true,
  nextAction: { label: 'View / Continue', href: '/contracts/c1/workflow/erection/method-statement' },
  assignedToUserId: null,
  assignedToName: null,
  assignedDepartment: null,
  assignmentStatus: null,
  viewerActionMode: 'ACT',
  assignmentSource: 'NONE',
};

describe('ERECTION_METHOD_STATEMENT_DISPLAY_LABELS', () => {
  it('covers every real backend status', () => {
    expect(ERECTION_METHOD_STATEMENT_DISPLAY_LABELS.NOT_STARTED).toBe('Not Started');
    expect(ERECTION_METHOD_STATEMENT_DISPLAY_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_METHOD_STATEMENT_DISPLAY_LABELS.SUBMITTED_FOR_APPROVAL).toBe('Submitted for Approval');
    expect(ERECTION_METHOD_STATEMENT_DISPLAY_LABELS.ISSUED).toBe('Issued');
  });
});

describe('ERECTION_SCHEDULE_DISPLAY_LABELS', () => {
  it('covers every real backend status', () => {
    expect(ERECTION_SCHEDULE_DISPLAY_LABELS.NOT_STARTED).toBe('Not Started');
    expect(ERECTION_SCHEDULE_DISPLAY_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_SCHEDULE_DISPLAY_LABELS.ISSUED).toBe('Issued');
    expect(ERECTION_SCHEDULE_DISPLAY_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_SCHEDULE_DISPLAY_LABELS.RETURNED).toBe('Returned');
  });
});

describe('ERECTION_DELIVERY_START_DISPLAY_LABELS', () => {
  it('covers every real backend status', () => {
    expect(ERECTION_DELIVERY_START_DISPLAY_LABELS.NOT_STARTED).toBe('Not Started');
    expect(ERECTION_DELIVERY_START_DISPLAY_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_DELIVERY_START_DISPLAY_LABELS.STARTED).toBe('Started');
    expect(ERECTION_DELIVERY_START_DISPLAY_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_DELIVERY_START_DISPLAY_LABELS.RETURNED).toBe('Returned');
  });
});

describe('ERECTION_START_DISPLAY_LABELS', () => {
  it('covers every real backend status', () => {
    expect(ERECTION_START_DISPLAY_LABELS.NOT_STARTED).toBe('Not Started');
    expect(ERECTION_START_DISPLAY_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_START_DISPLAY_LABELS.STARTED).toBe('Started');
    expect(ERECTION_START_DISPLAY_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_START_DISPLAY_LABELS.RETURNED).toBe('Returned');
  });
});

describe('ERECTION_CHECKLIST_DISPLAY_LABELS', () => {
  it('covers every real backend status', () => {
    expect(ERECTION_CHECKLIST_DISPLAY_LABELS.NOT_STARTED).toBe('Not Started');
    expect(ERECTION_CHECKLIST_DISPLAY_LABELS.DRAFT).toBe('Draft');
    expect(ERECTION_CHECKLIST_DISPLAY_LABELS.SUBMITTED_FOR_VERIFICATION).toBe('Submitted for Verification');
    expect(ERECTION_CHECKLIST_DISPLAY_LABELS.VERIFIED).toBe('Verified');
    expect(ERECTION_CHECKLIST_DISPLAY_LABELS.HOLD).toBe('Hold');
    expect(ERECTION_CHECKLIST_DISPLAY_LABELS.RETURNED).toBe('Returned');
  });
});

describe('ERECTION_ATTENTION_LABELS', () => {
  it('covers every real attention bucket', () => {
    expect(ERECTION_ATTENTION_LABELS.OVERDUE).toBe('Overdue');
    expect(ERECTION_ATTENTION_LABELS.AWAITING_APPROVAL).toBe('Awaiting Approval');
    expect(ERECTION_ATTENTION_LABELS.ON_TRACK).toBe('On Track');
    expect(ERECTION_ATTENTION_LABELS.NEEDS_PLANNING).toBe('Needs Planning');
  });
});

describe('matchesErectionWorkQueueFilters', () => {
  it('matches everything with default (empty) filters', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, DEFAULT_ERECTION_WORK_QUEUE_FILTERS)).toBe(true);
  });

  it('matches by contract number search', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, search: 'contract-2026-000004' })).toBe(true);
  });

  it('matches by job order number search (case-insensitive)', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, search: 'jo-004' })).toBe(true);
  });

  it('matches by project name search', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, search: 'boundary wall' })).toBe(true);
  });

  it('matches by client search', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, search: 'gulf ready mix' })).toBe(true);
  });

  it('excludes a row when the search has no match anywhere', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, search: 'no such contract' })).toBe(false);
  });

  it('filters by Method Statement Status', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, methodStatementStatus: 'DRAFT' })).toBe(true);
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, methodStatementStatus: 'ISSUED' })).toBe(false);
  });

  it('filters by Attention', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, attention: 'NEEDS_PLANNING' })).toBe(true);
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, attention: 'OVERDUE' })).toBe(false);
  });

  it('filters by Contract Status', () => {
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, contractStatus: 'ACTIVE' })).toBe(true);
    expect(matchesErectionWorkQueueFilters(BASE_ROW, { ...DEFAULT_ERECTION_WORK_QUEUE_FILTERS, contractStatus: 'DRAFT' })).toBe(false);
  });

  it('applies every filter together (AND, not OR)', () => {
    expect(
      matchesErectionWorkQueueFilters(BASE_ROW, {
        search: 'GRM',
        methodStatementStatus: 'DRAFT',
        attention: 'NEEDS_PLANNING',
        contractStatus: 'ACTIVE',
      }),
    ).toBe(true);
    expect(
      matchesErectionWorkQueueFilters(BASE_ROW, {
        search: 'GRM',
        methodStatementStatus: 'ISSUED',
        attention: 'NEEDS_PLANNING',
        contractStatus: 'ACTIVE',
      }),
    ).toBe(false);
  });
});
