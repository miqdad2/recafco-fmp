import { describe, it, expect } from 'vitest';
import type { BoqConfirmationItem } from '@/lib/technical-api';
import {
  FILTER_CHIPS,
  boqProgressText,
  buildAttentionPanelRows,
  buildProjectRow,
  filterRows,
  matchesFilter,
  matchesSearch,
  reached,
  rowActions,
  selectedProgressMessage,
  stageText,
  statusLabel,
  sumProgress,
  summarizeProgress,
} from './project-overview-helpers';
import type { ProjectProgress, ProjectRow } from './project-overview-helpers';

const progress = (over: Partial<ProjectProgress> = {}): ProjectProgress => ({
  confirmed: 0, generated: 0, inProduction: 0, produced: 0, inStore: 0, delivered: 0, erected: 0, completed: 0, needsReview: 0, hasItems: true, ...over,
});

const row = (over: Partial<Omit<ProjectRow, 'reasons'>> = {}): ProjectRow =>
  buildProjectRow({
    id: 'c1', referenceNumber: 'CON-2026-001', title: 'Hospital Precast', status: 'ACTIVE', client: 'Ministry of Health', jobOrder: 'JO-77', openClaims: 0,
    progress: progress(), ...over,
  });

const item = (over: Partial<BoqConfirmationItem>): BoqConfirmationItem =>
  ({ boqItemId: 'i', sortOrder: 1, description: 'x', contractQty: null, contractUnit: null, confirmedPieces: 0, confirmations: [], piecesGenerated: 0, statusCounts: {}, pendingPieces: 0, needsAttention: false, ...over }) as BoqConfirmationItem;

describe('summarizeProgress', () => {
  it('is null when the BOQ could not be loaded, and hasItems=false for none', () => {
    expect(summarizeProgress(null)).toBeNull();
    expect(summarizeProgress([])?.hasItems).toBe(false);
  });

  it('sums piece counts across items', () => {
    const p = summarizeProgress([
      item({ confirmedPieces: 10, piecesGenerated: 10, statusCounts: { IN_PRODUCTION: 2, PRODUCED: 3, IN_STORE: 1 } }),
      item({ confirmedPieces: 5, piecesGenerated: 5, statusCounts: { DELIVERED: 2, COMPLETED: 1 } }),
    ])!;
    expect(p).toMatchObject({ confirmed: 15, generated: 15, inProduction: 2, produced: 3, inStore: 1, delivered: 2, completed: 1, hasItems: true });
  });
});

describe('reached (cumulative stages)', () => {
  it('counts pieces that passed a stage too', () => {
    expect(reached(progress({ inProduction: 1, produced: 2, inStore: 1, delivered: 3, erected: 2, completed: 1 }))).toEqual({
      erected: 3, delivered: 6, produced: 9, productionStarted: 10,
    });
  });
});

describe('Needs Attention reasons', () => {
  it('a Draft contract is waiting for approval', () => {
    expect(row({ status: 'DRAFT', progress: null }).reasons.map((r) => r.key)).toEqual(['APPROVAL']);
  });

  it('an active contract with nothing confirmed has BOQ not confirmed', () => {
    expect(row().reasons.map((r) => r.key)).toEqual(['BOQ_NOT_CONFIRMED']);
  });

  it('walks the pending step as pieces move', () => {
    expect(row({ progress: progress({ confirmed: 4, generated: 4 }) }).reasons.map((r) => r.key)).toEqual(['PRODUCTION_NOT_STARTED']);
    expect(row({ progress: progress({ confirmed: 4, generated: 4, produced: 2 }) }).reasons.map((r) => r.key)).toEqual(['DELIVERY_PENDING']);
    expect(row({ progress: progress({ confirmed: 4, generated: 4, delivered: 2 }) }).reasons.map((r) => r.key)).toEqual(['ERECTION_PENDING']);
  });

  it('open claims and BOQ review are attention items; closed contracts raise nothing', () => {
    const r = row({ openClaims: 2, progress: progress({ confirmed: 1, generated: 1, inProduction: 1, needsReview: 1 }) });
    expect(r.reasons.map((x) => x.key)).toEqual(['BOQ_REVIEW', 'CLAIMS']);
    expect(r.reasons.every((x) => x.kind === 'attention')).toBe(true);
    expect(row({ status: 'CLOSED', openClaims: 3 }).reasons).toEqual([]);
  });

  it('makes no claim when the BOQ is unknown', () => {
    expect(row({ progress: null }).reasons).toEqual([]);
  });
});

describe('filter chips', () => {
  it('has exactly the eight requested chips', () => {
    expect(FILTER_CHIPS.map((c) => c.label)).toEqual(['All', 'Active', 'Needs Attention', 'BOQ In Progress', 'Production Started', 'Delivered', 'Erected', 'Completed']);
  });

  it('matches each chip from existing data', () => {
    const moving = row({ progress: progress({ confirmed: 10, generated: 10, produced: 4, delivered: 3, erected: 1, completed: 0 }) });
    expect(matchesFilter(moving, 'ALL')).toBe(true);
    expect(matchesFilter(moving, 'ACTIVE')).toBe(true);
    expect(matchesFilter(moving, 'BOQ_IN_PROGRESS')).toBe(true);
    expect(matchesFilter(moving, 'PRODUCTION_STARTED')).toBe(true);
    expect(matchesFilter(moving, 'DELIVERED')).toBe(true);
    expect(matchesFilter(moving, 'ERECTED')).toBe(true);
    expect(matchesFilter(moving, 'COMPLETED')).toBe(false);
    expect(matchesFilter(moving, 'ATTENTION')).toBe(false);

    const done = row({ progress: progress({ confirmed: 5, generated: 5, completed: 5 }) });
    expect(matchesFilter(done, 'COMPLETED')).toBe(true);
    expect(matchesFilter(done, 'BOQ_IN_PROGRESS')).toBe(false);
    expect(matchesFilter(row({ status: 'CLOSED', progress: null }), 'COMPLETED')).toBe(true);
    expect(matchesFilter(row({ progress: null }), 'DELIVERED')).toBe(false);
  });
});

describe('search and combined filtering', () => {
  it('finds by contract no, project name, job order or client, ignoring case', () => {
    for (const q of ['con-2026-001', 'hospital', 'jo-77', 'ministry']) expect(matchesSearch(row(), q)).toBe(true);
    expect(matchesSearch(row(), 'airport')).toBe(false);
    expect(matchesSearch(row(), '   ')).toBe(true);
  });

  it('applies search, chip and attention reason together', () => {
    const a = row({ id: 'a', title: 'Alpha', status: 'DRAFT', progress: null });
    const b = row({ id: 'b', title: 'Beta' });
    expect(filterRows([a, b], { query: '', filter: 'ALL', reason: 'APPROVAL' }).map((r) => r.id)).toEqual(['a']);
    expect(filterRows([a, b], { query: 'beta', filter: 'ACTIVE', reason: null }).map((r) => r.id)).toEqual(['b']);
    expect(filterRows([a, b], { query: 'beta', filter: 'ALL', reason: 'APPROVAL' })).toEqual([]);
  });
});

describe('Needs Attention panel', () => {
  it('has the seven requested rows in order, counting the listed contracts', () => {
    const rows = [
      row({ id: 'a', status: 'DRAFT', progress: null }),
      row({ id: 'b' }),
      row({ id: 'c', openClaims: 1, progress: progress({ confirmed: 2, generated: 2, produced: 1 }) }),
    ];
    const panel = buildAttentionPanelRows(rows, 4);
    expect(panel.map((p) => p.label)).toEqual([
      'Pending Approval', 'BOQ Not Confirmed', 'Production Not Started', 'Delivery Pending', 'Erection Pending', 'Payments Pending', 'Open Claims / Issues',
    ]);
    expect(panel.map((p) => p.value)).toEqual([1, 1, 0, 1, 0, 4, 1]);
    expect(panel.find((p) => p.label === 'Payments Pending')?.href).toBe('/contracts/payments');
  });
});

describe('display text', () => {
  it('uses plain words', () => {
    expect(statusLabel('ACTIVE')).toBe('Active');
    expect(statusLabel('SOMETHING_NEW')).toBe('Something new');
    expect(boqProgressText(null)).toBe('—');
    expect(boqProgressText(progress({ hasItems: false }))).toBe('No BOQ items');
    expect(boqProgressText(progress())).toBe('Not confirmed');
    expect(boqProgressText(progress({ confirmed: 3 }))).toBe('Not generated');
    expect(boqProgressText(progress({ confirmed: 10, generated: 10, completed: 4 }))).toBe('4 of 10 completed');
    expect(stageText(0, progress({ generated: 10 }))).toBe('Not started');
    expect(stageText(3, progress({ generated: 10 }))).toBe('3 of 10');
    expect(stageText(0, progress())).toBe('—');
    expect(stageText(0, null)).toBe('—');
  });

  it('explains an empty selected contract in one sentence', () => {
    expect(selectedProgressMessage(null)).toContain('could not be loaded');
    expect(selectedProgressMessage(progress({ hasItems: false }))).toBe('No BOQ progress found for this contract.');
    expect(selectedProgressMessage(progress())).toBe('Technical has not confirmed drawing pieces yet.');
    expect(selectedProgressMessage(progress({ confirmed: 2 }))).toBe('Pieces have not been generated yet.');
    expect(selectedProgressMessage(progress({ confirmed: 2, generated: 2 }))).toBeNull();
  });

  it('sums progress over listed contracts, skipping unknown ones', () => {
    const total = sumProgress([row({ progress: progress({ confirmed: 2, generated: 2 }) }), row({ progress: null }), row({ progress: progress({ confirmed: 3, generated: 3, completed: 1 }) })]);
    expect(total).toMatchObject({ confirmed: 5, generated: 5, completed: 1 });
  });
});

describe('row actions follow existing permissions', () => {
  const ids = (a: { key: string }[]): string[] => a.map((x) => x.key);

  it('everyone gets View and BOQ, and nothing else without permissions', () => {
    const a = rowActions({ id: 'c1', status: 'ACTIVE' }, ['contracts.read']);
    expect(ids(a.primary)).toEqual(['view', 'boq']);
    expect(a.primary.map((x) => x.href)).toEqual(['/contracts/c1', '/contracts/c1/boq-progress']);
    expect(a.more).toEqual([]);
    expect(rowActions({ id: 'c1', status: 'DRAFT' }, ['contracts.read']).more).toEqual([]);
  });

  it('contracts.update unlocks Edit (Draft only), Payments and Issues', () => {
    expect(ids(rowActions({ id: 'c1', status: 'DRAFT' }, ['contracts.read', 'contracts.update']).more)).toEqual(['edit', 'payments', 'issues']);
    expect(ids(rowActions({ id: 'c1', status: 'ACTIVE' }, ['contracts.read', 'contracts.update']).more)).toEqual(['payments', 'issues']);
  });

  it('Approve needs contracts.activate on a Draft', () => {
    expect(ids(rowActions({ id: 'c1', status: 'DRAFT' }, ['contracts.read', 'contracts.activate']).more)).toEqual(['approve']);
    expect(rowActions({ id: 'c1', status: 'ACTIVE' }, ['contracts.read', 'contracts.activate']).more).toEqual([]);
  });
});
