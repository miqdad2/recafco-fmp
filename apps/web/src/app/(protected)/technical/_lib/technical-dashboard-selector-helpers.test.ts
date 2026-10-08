import { describe, it, expect } from 'vitest';
import type { TechnicalJobRow, TechnicalAttentionItem } from '@/lib/technical-api';
import type { BoqConfirmationItem } from '@/lib/technical-api';
import {
  pickDefaultTechnicalJob,
  searchJobsLocally,
  fiveStepFlow,
  selectedJobBoqSummary,
  buildTechnicalNeedsAttentionRows,
  prioritizeJobsForTable,
} from './technical-dashboard-selector-helpers';

function makeJob(overrides: Partial<TechnicalJobRow> = {}): TechnicalJobRow {
  return {
    contractId: 'c1', jobOrderNo: 'JO-1', referenceNumber: 'CT-1', projectName: 'Tower A',
    clientEmployer: 'Client Co', contractManager: 'Mo', currentStage: null, nextStage: 'DRAWING_RECEIVED',
    status: null, priority: null, dueDate: null, assignedTo: null, updatedAt: '2026-01-01T00:00:00Z',
    workflowStarted: false,
    ...overrides,
  };
}

function makeAttentionItem(overrides: Partial<TechnicalAttentionItem> = {}): TechnicalAttentionItem {
  return {
    contractId: 'c1', jobOrderNo: 'JO-1', referenceNumber: 'CT-1', projectName: 'Tower A',
    reason: 'OVERDUE_PLANNED_REVIEW', detail: 'Overdue.', stage: 'DRAWING_RECEIVED',
    ...overrides,
  };
}

function makeBoqItem(overrides: Partial<BoqConfirmationItem> = {}): BoqConfirmationItem {
  return {
    boqItemId: 'item-1', sortOrder: 1, description: 'Column', contractQty: '10', contractUnit: 'nos',
    confirmedPieces: 10, confirmations: [], piecesGenerated: 10, statusCounts: { COMPLETED: 10 },
    pendingPieces: 0, needsAttention: false,
    ...overrides,
  };
}

describe('pickDefaultTechnicalJob', () => {
  it('picks the job behind the first Needs Attention item when one exists', () => {
    const jobs = [makeJob({ contractId: 'a' }), makeJob({ contractId: 'b' })];
    const attention = [makeAttentionItem({ contractId: 'b' })];
    expect(pickDefaultTechnicalJob(jobs, attention)?.contractId).toBe('b');
  });

  it('falls back to the first started, not-completed job when nothing needs attention', () => {
    const jobs = [
      makeJob({ contractId: 'a', workflowStarted: false }),
      makeJob({ contractId: 'b', workflowStarted: true, status: 'COMPLETED' }),
      makeJob({ contractId: 'c', workflowStarted: true, status: 'IN_PROGRESS' }),
    ];
    expect(pickDefaultTechnicalJob(jobs, [])?.contractId).toBe('c');
  });

  it('falls back to the first job of any kind as a last resort', () => {
    const jobs = [makeJob({ contractId: 'a', workflowStarted: false })];
    expect(pickDefaultTechnicalJob(jobs, [])?.contractId).toBe('a');
  });

  it('returns null for an empty jobs list', () => {
    expect(pickDefaultTechnicalJob([], [])).toBeNull();
  });
});

describe('searchJobsLocally', () => {
  const jobs = [
    makeJob({ contractId: 'a', jobOrderNo: 'JO-100', referenceNumber: 'CT-2026-01', projectName: 'Admin Building' }),
    makeJob({ contractId: 'b', jobOrderNo: null, referenceNumber: 'CT-2026-02', projectName: 'Warehouse Extension' }),
  ];

  it('returns nothing for an empty query', () => {
    expect(searchJobsLocally(jobs, '')).toEqual([]);
    expect(searchJobsLocally(jobs, '   ')).toEqual([]);
  });

  it('matches by job order, case-insensitively', () => {
    expect(searchJobsLocally(jobs, 'jo-100').map((j) => j.contractId)).toEqual(['a']);
  });

  it('matches by contract reference number', () => {
    expect(searchJobsLocally(jobs, 'ct-2026-02').map((j) => j.contractId)).toEqual(['b']);
  });

  it('matches by project name', () => {
    expect(searchJobsLocally(jobs, 'warehouse').map((j) => j.contractId)).toEqual(['b']);
  });

  it('does not throw on a job with no job order number', () => {
    expect(() => searchJobsLocally(jobs, 'anything')).not.toThrow();
  });
});

describe('fiveStepFlow', () => {
  it('marks every step pending for a job that has not started', () => {
    const steps = fiveStepFlow({ workflowStarted: false, currentStage: null, status: null });
    expect(steps.map((s) => s.state)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
  });

  it('marks earlier stages done, the current stage current, later stages pending', () => {
    const steps = fiveStepFlow({ workflowStarted: true, currentStage: 'GETTING_APPROVAL', status: 'IN_PROGRESS' });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'pending', 'pending']);
  });

  it('marks every step done, including Ready, once the workflow is completed', () => {
    const steps = fiveStepFlow({ workflowStarted: true, currentStage: 'FD_ISSUANCE', status: 'COMPLETED' });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('uses the required simple labels in order', () => {
    const steps = fiveStepFlow({ workflowStarted: false, currentStage: null, status: null });
    expect(steps.map((s) => s.label)).toEqual(['Drawing', 'SD & Calc.', 'Approval', 'FD Issued', 'Ready']);
  });
});

describe('selectedJobBoqSummary', () => {
  it('shows the empty message for null', () => {
    expect(selectedJobBoqSummary(null).emptyMessage).toBe('No BOQ drawing confirmation yet.');
  });

  it('shows the empty message for an empty item list', () => {
    expect(selectedJobBoqSummary([]).emptyMessage).toBe('No BOQ drawing confirmation yet.');
  });

  it('returns real numbers once items exist', () => {
    const items = [makeBoqItem(), makeBoqItem({ boqItemId: 'item-2' })];
    const summary = selectedJobBoqSummary(items);
    expect(summary.emptyMessage).toBeNull();
    expect(summary.boqItemCount).toBe(2);
    expect(summary.confirmedPieces).toBe(20);
    expect(summary.piecesGenerated).toBe(20);
    expect(summary.needsAttention).toBe(false);
  });

  it('flags needsAttention when confirmed and generated pieces do not match', () => {
    const items = [makeBoqItem({ confirmedPieces: 10, piecesGenerated: 4 })];
    expect(selectedJobBoqSummary(items).needsAttention).toBe(true);
  });
});

describe('buildTechnicalNeedsAttentionRows', () => {
  it('always returns exactly 5 rows in the required order', () => {
    const rows = buildTechnicalNeedsAttentionRows({
      needsAttention: [], waitingApproval: 0, missingBoqConfirmation: 0, confirmedPiecesNotGenerated: 0, rejectedOrHoldPieces: 0,
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Overdue Jobs', 'Waiting Approval', 'Missing BOQ Drawing Confirmation', 'Confirmed Pieces Not Generated', 'Rejected / Hold Pieces',
    ]);
  });

  it('counts distinct contracts with an OVERDUE_* reason as Overdue Jobs', () => {
    const rows = buildTechnicalNeedsAttentionRows({
      needsAttention: [
        makeAttentionItem({ contractId: 'a', reason: 'OVERDUE_PLANNED_REVIEW' }),
        makeAttentionItem({ contractId: 'a', reason: 'OVERDUE_TARGET_APPROVAL' }),
        makeAttentionItem({ contractId: 'b', reason: 'URGENT_PRIORITY' }),
      ],
      waitingApproval: 0, missingBoqConfirmation: 0, confirmedPiecesNotGenerated: 0, rejectedOrHoldPieces: 0,
    });
    // 'a' counted once despite 2 overdue reasons; 'b' not counted (URGENT_PRIORITY isn't an OVERDUE_* reason).
    expect(rows.find((r) => r.label === 'Overdue Jobs')?.value).toBe(1);
  });

  it('carries the real BOQ attention values through unchanged', () => {
    const rows = buildTechnicalNeedsAttentionRows({
      needsAttention: [], waitingApproval: 3, missingBoqConfirmation: 2, confirmedPiecesNotGenerated: 1, rejectedOrHoldPieces: 5,
    });
    expect(rows.map((r) => r.value)).toEqual([0, 3, 2, 1, 5]);
  });
});

describe('prioritizeJobsForTable', () => {
  it('moves flagged/urgent jobs to the front, keeping relative order otherwise', () => {
    const jobs = [
      makeJob({ contractId: 'a', priority: null }),
      makeJob({ contractId: 'b', priority: 'URGENT' }),
      makeJob({ contractId: 'c', priority: null }),
    ];
    const attention = [makeAttentionItem({ contractId: 'c' })];
    const result = prioritizeJobsForTable(jobs, attention);
    expect(result.map((j) => j.contractId)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the original array', () => {
    const jobs = [makeJob({ contractId: 'a' })];
    const result = prioritizeJobsForTable(jobs, []);
    expect(result).not.toBe(jobs);
  });
});

// ---------------------------------------------------------------------------
// FMP-BOQ-16 — drawing group / release status
// ---------------------------------------------------------------------------
import {
  jobReleaseNote,
  releaseFlow,
  releaseCounts,
  jobReleaseIndicator,
  buildReleaseAttentionRows,
  buildNextActionItems,
  RELEASE_MESSAGES,
} from './technical-dashboard-selector-helpers';
import type { JobReleaseSummary } from '@/lib/technical-api';

const rel = (over: Partial<JobReleaseSummary> = {}): JobReleaseSummary => ({
  confirmed: 50, generated: 50, assigned: 40, notAssigned: 10, filesAttachedPieces: 30, released: 25, notReleased: 15,
  groupsTotal: 3, groupsWithFiles: 2, groupsNoFiles: 1, groupsSubmitted: 1, groupsApproved: 1, groupsNotReleased: 2, confirmedNotGenerated: 0,
  ...over,
});
const jobRow = (id: string, order: string): TechnicalJobRow =>
  ({ contractId: id, jobOrderNo: order, referenceNumber: `REF-${id}`, projectName: `Project ${id}` }) as unknown as TechnicalJobRow;

describe('selected job release numbers', () => {
  it('shows assigned / not assigned and released / not released counts', () => {
    const counts = Object.fromEntries(releaseCounts(rel()).map((c) => [c.label, c.value]));
    expect(counts).toEqual({
      'Pieces Generated': 50, 'Assigned to Groups': 40, 'Not Assigned': 10, 'Released to Production': 25, 'Not Released': 15, 'Groups with No Files': 1,
    });
    expect(releaseCounts(rel()).find((c) => c.label === 'Not Assigned')?.warn).toBe(true);
  });
  it('flow is Confirmed → Generated → Grouped → Files Attached → Released', () => {
    expect(releaseFlow(rel()).map((s) => `${s.label} ${s.count}`)).toEqual(['Confirmed 50', 'Generated 50', 'Grouped 40', 'Files Attached 30', 'Released 25']);
  });
  it('explains what is missing in plain words, in order', () => {
    expect(jobReleaseNote(rel({ generated: 0 }))).toBe('No pieces generated yet.');
    expect(jobReleaseNote(rel({ groupsTotal: 0, assigned: 0 }))).toBe('No drawing groups created yet.');
    expect(jobReleaseNote(rel({ released: 0 }))).toBe('No pieces released to Production yet.');
    expect(jobReleaseNote(rel())).toBeNull();
    expect(jobReleaseNote(undefined)).toBeNull();
    expect(RELEASE_MESSAGES.upToDate).toBe('All Technical release work is up to date.');
  });
  it('job table indicator: groups missing / not assigned / generated vs released', () => {
    expect(jobReleaseIndicator(undefined)).toBeNull();
    expect(jobReleaseIndicator(rel({ generated: 0 }))).toBeNull();
    expect(jobReleaseIndicator(rel({ groupsTotal: 0 }))).toBe('No groups');
    expect(jobReleaseIndicator(rel())).toBe('10 not assigned');
    expect(jobReleaseIndicator(rel({ notAssigned: 0 }))).toBe('50 generated / 25 released');
  });
});

describe('Needs Attention (Technical release)', () => {
  it('adds pieces not assigned, groups not released and groups with no files, summed over jobs', () => {
    const rows = buildReleaseAttentionRows({ a: rel(), b: rel({ notAssigned: 5, groupsNotReleased: 1, groupsNoFiles: 2 }) });
    expect(rows).toEqual([
      { label: 'Pieces Not Assigned', value: 15, tone: 'warning' },
      { label: 'Groups Not Released', value: 3, tone: 'warning' },
      { label: 'Groups With No Files', value: 3, tone: 'warning' },
    ]);
  });
  it('all zero when nothing is outstanding (or there are no groups yet)', () => {
    expect(buildReleaseAttentionRows({}).every((r) => r.value === 0)).toBe(true);
  });
});

describe('Next Action Focus priorities', () => {
  const jobs = [jobRow('a', 'JO-A'), jobRow('b', 'JO-B'), jobRow('c', 'JO-C')];
  const wf = [{ contractId: 'c', jobOrderNo: 'JO-C', referenceNumber: 'REF-c', projectName: 'Project c', reason: 'OVERDUE_REVIEW', detail: 'x', stage: 'DRAWING_RECEIVED' }] as unknown as TechnicalAttentionItem[];
  const base = { confirmedNotGenerated: 0, notAssigned: 0, groupsNoFiles: 0, groupsSubmitted: 0, groupsApproved: 0 };

  it('puts not-assigned pieces before the existing workflow action', () => {
    const items = buildNextActionItems(jobs, { a: rel({ ...base, notAssigned: 12 }) }, wf);
    expect(items.map((i) => i.text)).toEqual(['12 pieces not assigned to groups', '']);
    expect(items[1]?.stage).toBe('DRAWING_RECEIVED');
  });
  it('orders: not generated, not assigned, no files, waiting approval, waiting release', () => {
    const items = buildNextActionItems(
      jobs,
      {
        a: rel({ ...base, groupsApproved: 1 }),
        b: rel({ ...base, groupsSubmitted: 2 }),
        c: rel({ ...base, groupsNoFiles: 1, notAssigned: 3, confirmedNotGenerated: 8 }),
      },
      [],
    );
    expect(items.map((i) => i.text)).toEqual([
      '8 confirmed pieces not generated',
      '3 pieces not assigned to groups',
      '1 group has no files',
      '2 submitted groups waiting approval',
      '1 approved group waiting release',
    ]);
  });
  it('never shows more than 5 and links release items to the job page', () => {
    const many = Object.fromEntries(['a', 'b', 'c'].map((id) => [id, rel({ ...base, notAssigned: 1, groupsNoFiles: 1, groupsSubmitted: 1 })]));
    expect(buildNextActionItems(jobs, many, wf)).toHaveLength(5);
    expect(buildNextActionItems(jobs, many, [])[0]?.contractId).toBeDefined();
  });
  it('is empty when everything is up to date', () => {
    expect(buildNextActionItems(jobs, { a: rel({ ...base }) }, [])).toEqual([]);
  });
});
