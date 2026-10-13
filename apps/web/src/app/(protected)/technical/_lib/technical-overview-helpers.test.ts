import { describe, it, expect } from 'vitest';
import type { TechnicalJobRow, JobReleaseSummary } from '@/lib/technical-api';
import {
  technicalOverviewStatus,
  productionReleaseStatus,
  piecesStatusText,
  overviewNextAction,
  buildOverviewRows,
  filterOverviewRows,
  buildOverviewSummary,
  buildOverviewAttentionRows,
  filterRowsByQuickFilter,
  quickFilterCounts,
  ATTENTION_FILTERS,
} from './technical-overview-helpers';
import type { OverviewFilter } from './technical-overview-helpers';

function makeJob(o: Partial<TechnicalJobRow> = {}): TechnicalJobRow {
  return {
    contractId: 'c1', jobOrderNo: 'JO-1', referenceNumber: 'CT-1', projectName: 'Tower A',
    clientEmployer: 'Client Co', contractManager: 'Mo', currentStage: 'DRAWING_RECEIVED', nextStage: null,
    status: 'IN_PROGRESS', priority: null, dueDate: null, assignedTo: null, updatedAt: '2026-01-01T00:00:00Z',
    workflowStarted: true,
    ...o,
  } as TechnicalJobRow;
}

function makeRelease(o: Partial<JobReleaseSummary> = {}): JobReleaseSummary {
  return {
    confirmed: 0, generated: 0, assigned: 0, notAssigned: 0, filesAttachedPieces: 0, released: 0, notReleased: 0,
    groupsTotal: 0, groupsWithFiles: 0, groupsNoFiles: 0, groupsSubmitted: 0, groupsApproved: 0, groupsNotReleased: 0,
    confirmedNotGenerated: 0, individuallyCovered: 0, individuallyReleased: 0,
    ...o,
  };
}

describe('technicalOverviewStatus', () => {
  it('Not Started when the workflow has not started', () => {
    expect(technicalOverviewStatus(makeJob({ workflowStarted: false }), undefined)).toBe('Not Started');
  });
  it('BOQ Drawings Available at the first stage with nothing confirmed', () => {
    expect(technicalOverviewStatus(makeJob(), makeRelease())).toBe('BOQ Drawings Available');
  });
  it('Elements Not Confirmed past the first stage with nothing confirmed', () => {
    expect(technicalOverviewStatus(makeJob({ currentStage: 'GETTING_APPROVAL' }), makeRelease())).toBe('Elements Not Confirmed');
  });
  it('Elements Confirmed when confirmed but not generated', () => {
    expect(technicalOverviewStatus(makeJob(), makeRelease({ confirmed: 30 }))).toBe('Elements Confirmed');
  });
  it('Waiting Final Drawing right after elements are generated — grouping is optional', () => {
    expect(technicalOverviewStatus(makeJob(), makeRelease({ confirmed: 30, generated: 30 }))).toBe('Waiting Final Drawing');
    // a group with no file does not cover anything
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, groupsTotal: 1, assigned: 30, groupsNoFiles: 1 }))).toBe('Waiting Final Drawing');
  });
  it('Partially Covered when only some elements have final drawings (group or individual)', () => {
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, groupsTotal: 1, filesAttachedPieces: 10 }))).toBe('Partially Covered');
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, individuallyCovered: 5 }))).toBe('Partially Covered');
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, filesAttachedPieces: 20, individuallyCovered: 5 }))).toBe('Partially Covered');
  });
  it('Ready to Release when every element is covered, by group files, individual files, or both', () => {
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, filesAttachedPieces: 30 }))).toBe('Ready to Release');
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, individuallyCovered: 30 }))).toBe('Ready to Release');
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, filesAttachedPieces: 20, individuallyCovered: 10 }))).toBe('Ready to Release');
  });
  it('Released to Production once every element is released, through groups and/or on its own', () => {
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, filesAttachedPieces: 30, released: 30 }))).toBe('Released to Production');
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, filesAttachedPieces: 20, individuallyCovered: 10, released: 20, individuallyReleased: 10 }))).toBe('Released to Production');
    // partial release keeps the rest ready
    expect(technicalOverviewStatus(makeJob(), makeRelease({ generated: 30, filesAttachedPieces: 30, released: 10 }))).toBe('Ready to Release');
  });
});

describe('productionReleaseStatus', () => {
  it('maps each status to the simple release text', () => {
    expect(productionReleaseStatus('Not Started', undefined)).toBe('Not ready');
    expect(productionReleaseStatus('Waiting Final Drawing', makeRelease())).toBe('Waiting final drawings');
    expect(productionReleaseStatus('Partially Covered', makeRelease())).toBe('Waiting final drawings');
    expect(productionReleaseStatus('Partially Covered', makeRelease({ individuallyReleased: 2 }))).toBe('Waiting release');
    expect(productionReleaseStatus('Ready to Release', makeRelease())).toBe('Waiting release');
    expect(productionReleaseStatus('Released to Production', makeRelease())).toBe('Released');
  });
});

describe('piecesStatusText', () => {
  it('uses plain wording from existing counts', () => {
    expect(piecesStatusText(makeJob(), makeRelease())).toBe('Not confirmed');
    expect(piecesStatusText(makeJob({ workflowStarted: false }), undefined)).toBe('Not confirmed');
    expect(piecesStatusText(makeJob(), makeRelease({ confirmed: 30 }))).toBe('30 elements confirmed');
    expect(piecesStatusText(makeJob(), makeRelease({ confirmed: 1 }))).toBe('1 element confirmed');
    expect(piecesStatusText(makeJob(), makeRelease({ generated: 30 }))).toBe('30 elements generated · waiting for final drawings');
    expect(piecesStatusText(makeJob(), makeRelease({ generated: 30, filesAttachedPieces: 10 }))).toBe('30 elements generated · 10 with final drawings');
    expect(piecesStatusText(makeJob(), makeRelease({ generated: 30, individuallyCovered: 30 }))).toBe('30 elements generated · all have final drawings');
  });
});

describe('overviewNextAction', () => {
  it('uses the approved action labels', () => {
    expect(overviewNextAction('Not Started')).toBe('Start Technical Work');
    expect(overviewNextAction('Elements Not Confirmed')).toBe('Confirm Elements');
    expect(overviewNextAction('Waiting Final Drawing')).toBe('Add Final Drawing Files');
    expect(overviewNextAction('Partially Covered')).toBe('Add Final Drawing Files');
    expect(overviewNextAction('Ready to Release')).toBe('Release to Production');
  });
});

describe('rows, search, summary, attention', () => {
  const jobs = [
    makeJob({ contractId: 'a', jobOrderNo: 'JO-100', projectName: 'Tower A', clientEmployer: 'Acme' }),
    makeJob({ contractId: 'b', jobOrderNo: null, referenceNumber: 'CT-200', projectName: 'Bridge', clientEmployer: 'Beta', workflowStarted: false }),
    makeJob({ contractId: 'c', jobOrderNo: 'JO-300', projectName: 'Mall', clientEmployer: 'Gamma' }),
  ];
  const releases = {
    a: makeRelease({ generated: 10, filesAttachedPieces: 10, groupsTotal: 1, groupsWithFiles: 1, notReleased: 10, groupsNotReleased: 1 }),
    c: makeRelease({ generated: 5, filesAttachedPieces: 2, groupsTotal: 2, groupsNoFiles: 1, groupsNotReleased: 2 }),
  };
  const rows = buildOverviewRows(jobs, releases);

  it('shows every job, not just one', () => {
    expect(rows).toHaveLength(3);
  });
  it('searches job order, contract no., project and client', () => {
    expect(filterOverviewRows(rows, 'jo-100').map((r) => r.job.contractId)).toEqual(['a']);
    expect(filterOverviewRows(rows, 'ct-200').map((r) => r.job.contractId)).toEqual(['b']);
    expect(filterOverviewRows(rows, 'mall').map((r) => r.job.contractId)).toEqual(['c']);
    expect(filterOverviewRows(rows, 'gamma').map((r) => r.job.contractId)).toEqual(['c']);
    expect(filterOverviewRows(rows, '  ')).toHaveLength(3);
  });
  it('builds the 4 summary counts', () => {
    expect(buildOverviewSummary(rows, { missingBoqConfirmation: 3, confirmedPiecesNotGenerated: 0, rejectedOrHoldPieces: 0 })).toEqual({
      projectsInTechnical: 3, drawingsReceived: 2, piecesNotConfirmed: 3, readyForProduction: 1,
    });
  });
  it('builds the 5 attention rows in order, counting elements not covered', () => {
    const attention = buildOverviewAttentionRows({
      boqAttention: { missingBoqConfirmation: 3, confirmedPiecesNotGenerated: 0, rejectedOrHoldPieces: 0 },
      waitingApproval: 4,
      releaseByContract: releases,
    });
    expect(attention.map((r) => [r.label, r.value])).toEqual([
      ['Elements Not Confirmed', 3],
      ['Elements Waiting Final Drawing', 3],
      ['Groups Without Files', 1],
      ['Groups Not Released', 3],
      ['Waiting Approval', 4],
    ]);
  });
});

describe('quick filters', () => {
  const mk = (id: string, started: boolean, r?: Partial<JobReleaseSummary>, stage: TechnicalJobRow['currentStage'] = 'DRAWING_RECEIVED') =>
    ({ job: makeJob({ contractId: id, workflowStarted: started, currentStage: stage }), release: makeRelease(r) });
  const specs = [
    mk('n', false),
    mk('p', true),
    mk('w', true, { generated: 5 }),
    mk('f', true, { generated: 5, filesAttachedPieces: 2, groupsTotal: 1 }),
    mk('r', true, { generated: 5, individuallyCovered: 5 }),
    mk('x', true, { generated: 5, filesAttachedPieces: 5, released: 5 }),
  ];
  const rows = buildOverviewRows(specs.map((s) => s.job), Object.fromEntries(specs.map((s) => [s.job.contractId, s.release])));
  const ids = (f: OverviewFilter): string[] => filterRowsByQuickFilter(rows, f).map((r) => r.job.contractId);

  it('narrows rows by each chip', () => {
    expect(ids('all')).toHaveLength(6);
    expect(ids('new')).toEqual(['n']);
    expect(ids('needs-pieces')).toEqual(['p']);
    expect(ids('needs-final')).toEqual(['w', 'f']);
    expect(ids('ready')).toEqual(['r']);
    expect(ids('released')).toEqual(['x']);
  });
  it('counts per chip and maps attention rows to filters', () => {
    expect(quickFilterCounts(rows)).toEqual({ all: 6, new: 1, 'needs-pieces': 1, 'needs-final': 2, ready: 1, released: 1 });
    expect(ATTENTION_FILTERS['Waiting Approval']).toBeNull();
    expect(ATTENTION_FILTERS['Elements Waiting Final Drawing']).toBe('needs-final');
  });
});
