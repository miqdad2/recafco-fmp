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
  confirmed: 0, generated: 0, released: null, inProduction: 0, produced: 0, inStore: 0, delivered: 0, erected: 0, completed: 0, needsReview: 0, hasItems: true, ...over,
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
    expect(selectedProgressMessage(progress())).toBe('Technical has not confirmed drawing elements yet.');
    expect(selectedProgressMessage(progress({ confirmed: 2 }))).toBe('Elements have not been generated yet.');
    expect(selectedProgressMessage(progress({ confirmed: 2, generated: 2 }))).toBeNull();
  });

  it('sums progress over listed contracts, skipping unknown ones', () => {
    const total = sumProgress([row({ progress: progress({ confirmed: 2, generated: 2 }) }), row({ progress: null }), row({ progress: progress({ confirmed: 3, generated: 3, completed: 1 }) })]);
    expect(total).toMatchObject({ confirmed: 5, generated: 5, completed: 1 });
  });
});

describe('row actions (FMP-UI-47)', () => {
  it('a row has exactly Open Contract and BOQ, on the existing routes, with tooltips', () => {
    const a = rowActions({ id: 'c1' });
    expect(a.map((x) => x.label)).toEqual(['Open Contract', 'BOQ Progress']);
    expect(a.map((x) => x.href)).toEqual(['/contracts/c1', '/contracts/c1/boq-progress']);
    expect(a.map((x) => x.title)).toEqual(['Open full contract details', 'Open BOQ progress']);
  });
});

// ---------------------------------------------------------------------------
// FMP-UI-48
// ---------------------------------------------------------------------------

import { boqElementsText, hasActiveFilters, projectCountText, selectedMetrics, stageCell, statusBadgeClass } from './project-overview-helpers';

describe('Selected Project Progress metrics', () => {
  it('lists the eight stages in order, with their own wording', () => {
    const m = selectedMetrics(progress({ confirmed: 10, released: 8, inProduction: 2, produced: 3, inStore: 1, delivered: 1, erected: 0, completed: 0, generated: 10 }));
    expect(m.map((x) => x.label)).toEqual([
      'Confirmed Elements', 'Released to Production', 'In Production', 'Produced', 'In Storage', 'Delivered', 'Erected', 'Completed',
    ]);
    expect(m.map((x) => x.value)).toEqual([10, 8, 2, 3, 1, 1, 0, 0]);
  });
  it('reports Released to Production as not available (null), never as 0, when release data was not loaded', () => {
    const m = selectedMetrics(progress({ released: null }));
    expect(m.find((x) => x.key === 'released')?.value).toBeNull();
  });
});

describe('summarizeProgress released figure', () => {
  const item = (technical?: { assigned: number; notAssigned: number; released: number; notReleased: number } | null) =>
    ({
      boqItemId: 'b', sortOrder: 1, description: 'x', contractQty: null, contractUnit: null, confirmedPieces: 4, confirmations: [], piecesGenerated: 4,
      statusCounts: {}, pendingPieces: 0, needsAttention: false, technical,
    }) as never;

  it('is the sum of released elements when every item carries release data', () => {
    const t = { assigned: 4, notAssigned: 0, released: 3, notReleased: 1 };
    expect(summarizeProgress([item(t), item(t)])?.released).toBe(6);
  });
  it('is null when any item lacks release data (the drawing groups could not be loaded)', () => {
    expect(summarizeProgress([item(undefined)])?.released).toBeNull();
    expect(summarizeProgress([item({ assigned: 1, notAssigned: 0, released: 1, notReleased: 0 }), item(null)])?.released).toBeNull();
  });
});

describe('table cells', () => {
  it('BOQ Elements column', () => {
    expect(boqElementsText(null)).toEqual({ primary: '—', secondary: null });
    expect(boqElementsText(progress({ hasItems: false }))).toEqual({ primary: 'No BOQ items', secondary: null });
    expect(boqElementsText(progress({ confirmed: 0 }))).toEqual({ primary: 'Not confirmed', secondary: null });
    expect(boqElementsText(progress({ confirmed: 12, generated: 0 }))).toEqual({ primary: '12 confirmed', secondary: 'Not generated' });
    expect(boqElementsText(progress({ confirmed: 12, generated: 12, completed: 3 }))).toEqual({ primary: '12 confirmed', secondary: '12 generated · 3 completed' });
  });
  it('stage cells name the stage', () => {
    expect(stageCell(8, progress({ generated: 12 }), 'produced')).toBe('8 of 12 produced');
    expect(stageCell(0, progress({ generated: 12 }), 'produced')).toBe('Not started');
    expect(stageCell(0, progress({ generated: 0 }), 'produced')).toBe('—');
  });
  it('status badges are green only for Active', () => {
    expect(statusBadgeClass('ACTIVE')).toContain('success');
    expect(statusBadgeClass('DRAFT')).not.toContain('success');
  });
});

describe('Reset Filters', () => {
  it('is offered only when a search, filter or attention tile is active', () => {
    expect(hasActiveFilters('', 'ALL', null)).toBe(false);
    expect(hasActiveFilters('  ', 'ALL', null)).toBe(false);
    expect(hasActiveFilters('tower', 'ALL', null)).toBe(true);
    expect(hasActiveFilters('', 'ACTIVE', null)).toBe(true);
    expect(hasActiveFilters('', 'ALL', 'CLAIMS')).toBe(true);
  });
});

describe('projectCountText (FMP-UI-49)', () => {
  const base = { shown: 20, loaded: 20, total: 134, filtersActive: false, searching: false };
  it('separates the loaded newest contracts from the total', () => {
    expect(projectCountText(base)).toBe('Showing the 20 newest of 134 contracts · select a row for its element progress');
  });
  it('is just the total when everything is loaded', () => {
    expect(projectCountText({ ...base, loaded: 3, shown: 3, total: 3 })).toBe('3 contracts');
    expect(projectCountText({ ...base, loaded: 1, shown: 1, total: 1 })).toBe('1 contract');
  });
  it('counts matches once a search or filter is active', () => {
    expect(projectCountText({ ...base, shown: 2, filtersActive: true })).toBe('2 matching');
    expect(projectCountText({ ...base, shown: 2, filtersActive: true, searching: true })).toBe('2 matching · searching all contracts…');
  });
});
