import { describe, it, expect } from 'vitest';
import type { BoqConfirmationItem } from '@/lib/technical-api';
import {
  pickDefaultContractId,
  formatBoqProgressForRow,
  buildTodaysFocus,
  buildNeedsAttentionRows,
  buildSelectedContractIssues,
  selectedContractProgressState,
  NO_BOQ_ITEMS_FOR_CONTRACT,
} from './dashboard-selector-helpers';

function makeItem(overrides: Partial<BoqConfirmationItem> = {}): BoqConfirmationItem {
  return {
    boqItemId: 'item-1',
    sortOrder: 1,
    description: 'Column',
    contractQty: '10',
    contractUnit: 'nos',
    confirmedPieces: 10,
    confirmations: [],
    piecesGenerated: 10,
    statusCounts: { COMPLETED: 10 },
    pendingPieces: 0,
    needsAttention: false,
    ...overrides,
  };
}

describe('pickDefaultContractId', () => {
  it('picks the first ACTIVE contract even if it is not first in the list', () => {
    const recent = [
      { id: 'c1', status: 'DRAFT', updatedAt: '2026-01-02' },
      { id: 'c2', status: 'ACTIVE', updatedAt: '2026-01-01' },
    ];
    expect(pickDefaultContractId(recent)).toBe('c2');
  });

  it('falls back to the first contract when none is ACTIVE', () => {
    const recent = [{ id: 'c1', status: 'DRAFT', updatedAt: '2026-01-02' }];
    expect(pickDefaultContractId(recent)).toBe('c1');
  });

  it('returns null for an empty list', () => {
    expect(pickDefaultContractId([])).toBeNull();
  });
});

describe('formatBoqProgressForRow', () => {
  it('reads null (fetch failed) as Not started', () => {
    expect(formatBoqProgressForRow(null)).toEqual({ text: 'Not started', tone: 'neutral' });
  });

  it('reads an empty item list as Not started', () => {
    expect(formatBoqProgressForRow([])).toEqual({ text: 'Not started', tone: 'neutral' });
  });

  it('reads zero generated pieces as Not started when nothing is confirmed yet either', () => {
    const items = [makeItem({ confirmedPieces: null, piecesGenerated: 0, statusCounts: {}, needsAttention: false })];
    expect(formatBoqProgressForRow(items)).toEqual({ text: 'Not started', tone: 'neutral' });
  });

  it('shows "N / M completed" when generated pieces exist and nothing needs review', () => {
    const items = [makeItem({ piecesGenerated: 10, statusCounts: { COMPLETED: 4 }, needsAttention: false })];
    expect(formatBoqProgressForRow(items)).toEqual({ text: '4 / 10 completed', tone: 'neutral' });
  });

  it('shows Needs Attention (warning) when any item needs review, even if some pieces are completed', () => {
    const items = [
      makeItem({ piecesGenerated: 10, statusCounts: { COMPLETED: 4 }, needsAttention: false }),
      makeItem({ boqItemId: 'item-2', confirmedPieces: 5, piecesGenerated: 3, needsAttention: true }),
    ];
    expect(formatBoqProgressForRow(items)).toEqual({ text: 'Needs Attention', tone: 'warning' });
  });
});

describe('buildTodaysFocus', () => {
  it('returns only the non-zero figures', () => {
    const result = buildTodaysFocus({
      approvalsWaiting: 2, paymentsPending: 0, claimsToReview: 1, boqItemsNeedingReview: 0, contractsClosingSoon: 0,
    });
    expect(result.map((r) => r.label)).toEqual(['Approvals waiting', 'Claims to review']);
  });

  it('returns an empty array when every figure is 0 (caller shows "No urgent items.")', () => {
    const result = buildTodaysFocus({
      approvalsWaiting: 0, paymentsPending: 0, claimsToReview: 0, boqItemsNeedingReview: 0, contractsClosingSoon: 0,
    });
    expect(result).toEqual([]);
  });

  it('caps at 5 items', () => {
    const result = buildTodaysFocus({
      approvalsWaiting: 1, paymentsPending: 1, claimsToReview: 1, boqItemsNeedingReview: 1, contractsClosingSoon: 1,
    });
    expect(result).toHaveLength(5);
  });
});

describe('buildNeedsAttentionRows', () => {
  it('always returns exactly 6 rows, even when every value is 0', () => {
    const rows = buildNeedsAttentionRows({
      pendingApprovals: 0, overdueWorkflowTasks: 0, openClaims: 0, outstandingPayments: 0, boqItemsNeedingReview: 0, criticalContracts: 0,
    });
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.value === 0)).toBe(true);
  });

  it('carries the real values through unchanged, in the required order', () => {
    const rows = buildNeedsAttentionRows({
      pendingApprovals: 3, overdueWorkflowTasks: 2, openClaims: 1, outstandingPayments: 4, boqItemsNeedingReview: 5, criticalContracts: 6,
    });
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Pending Approvals', 3],
      ['Overdue Workflow Tasks', 2],
      ['Open Claims', 1],
      ['Outstanding Payments', 4],
      ['BOQ Items Needing Review', 5],
      ['Critical Contracts', 6],
    ]);
  });
});

describe('selectedContractProgressState', () => {
  it('reports a load failure for null', () => {
    expect(selectedContractProgressState(null)).toBe('BOQ progress could not be loaded for this contract.');
  });

  it('reports no BOQ items for an empty list', () => {
    expect(selectedContractProgressState([])).toBe(NO_BOQ_ITEMS_FOR_CONTRACT);
  });

  it('reports no drawing confirmations when nothing is confirmed yet', () => {
    const items = [makeItem({ confirmedPieces: null, piecesGenerated: 0, statusCounts: {}, confirmations: [] })];
    expect(selectedContractProgressState(items)).toBe('Technical has not confirmed drawing pieces yet.');
  });

  it('reports pieces not generated when confirmed but nothing generated', () => {
    const items = [makeItem({ confirmedPieces: 10, piecesGenerated: 0, statusCounts: {} })];
    expect(selectedContractProgressState(items)).toBe('Pieces have not been generated yet.');
  });

  it('returns null (show real numbers) once pieces exist', () => {
    const items = [makeItem({ confirmedPieces: 10, piecesGenerated: 10, statusCounts: { COMPLETED: 4 } })];
    expect(selectedContractProgressState(items)).toBeNull();
  });
});

describe('buildSelectedContractIssues', () => {
  it('returns nothing for null or empty items', () => {
    expect(buildSelectedContractIssues(null)).toEqual([]);
    expect(buildSelectedContractIssues([])).toEqual([]);
  });

  it('returns nothing when nothing needs review and no pieces are on hold/rejected', () => {
    const items = [makeItem()];
    expect(buildSelectedContractIssues(items)).toEqual([]);
  });

  it('reports needs-review, on-hold, and rejected counts independently', () => {
    const items = [
      makeItem({ needsAttention: true, statusCounts: { ON_HOLD: 2, REJECTED: 1 } }),
    ];
    const issues = buildSelectedContractIssues(items);
    expect(issues).toEqual([
      { text: '1 BOQ item needs review' },
      { text: '2 pieces on hold' },
      { text: '1 rejected piece' },
    ]);
  });

  it('uses singular wording for a count of exactly 1', () => {
    const items = [makeItem({ needsAttention: true, statusCounts: { ON_HOLD: 1, REJECTED: 1 } })];
    const issues = buildSelectedContractIssues(items);
    expect(issues.map((i) => i.text)).toEqual([
      '1 BOQ item needs review',
      '1 piece on hold',
      '1 rejected piece',
    ]);
  });
});
