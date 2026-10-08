import { describe, it, expect } from 'vitest';
import type { BoqConfirmationItem } from '@/lib/technical-api';
import {
  PROGRESS_TILES,
  tileCount,
  completedProgress,
  attentionReasons,
  needsAttention,
  contractTotals,
  itemStateMessage,
  contractQtyText,
  MESSAGES,
  TOTAL_CARDS,
  withTechnicalRelease,
  progressFlow,
  technicalReleaseNote,
  pieceReleaseLabel,
} from './boq-progress-helpers';

function item(over: Partial<BoqConfirmationItem> = {}): BoqConfirmationItem {
  return {
    boqItemId: 'i1',
    sortOrder: 1,
    description: 'Hollowcore Slab',
    contractQty: '500.000',
    contractUnit: 'm²',
    confirmedPieces: 50,
    confirmations: [{ confirmationStatus: 'CONFIRMED' } as BoqConfirmationItem['confirmations'][number]],
    piecesGenerated: 50,
    statusCounts: { DRAWING_READY: 5, IN_PRODUCTION: 10, PRODUCED: 8, IN_STORE: 7, DELIVERED: 6, ERECTED: 10, COMPLETED: 4 },
    pendingPieces: 0,
    needsAttention: false,
    ...over,
  };
}

describe('status tiles', () => {
  it('counts each status correctly (the example from the brief)', () => {
    const i = item();
    expect(PROGRESS_TILES.map((t) => `${t.label} ${tileCount(i, t.key)}`)).toEqual([
      'Drawing Ready 5', 'In Production 10', 'Produced 8', 'In Store 7', 'Delivered 6', 'Erected 10', 'Completed 4', 'Hold / Rejected 0',
    ]);
  });
  it('Hold and Rejected share one tile', () => {
    expect(tileCount(item({ statusCounts: { ON_HOLD: 2, REJECTED: 1 } }), 'holdRejected')).toBe(3);
  });
});

describe('completedProgress', () => {
  it('is Completed / Pieces Generated, shown as "4 of 50 completed"', () => {
    expect(completedProgress(item())).toEqual({ completed: 4, generated: 50, percent: 8, text: '4 of 50 completed' });
  });
  it('is 0 (never NaN) when nothing is generated, and 100 when everything is completed', () => {
    expect(completedProgress(item({ piecesGenerated: 0, statusCounts: {} }))).toMatchObject({ percent: 0, text: '0 of 0 completed' });
    expect(completedProgress(item({ piecesGenerated: 10, statusCounts: { COMPLETED: 10 } })).percent).toBe(100);
  });
});

describe('Needs Attention', () => {
  it('is off when confirmed = generated and nothing is on hold, rejected or cancelled', () => {
    expect(needsAttention(item())).toBe(false);
    expect(attentionReasons(item())).toEqual([]);
  });
  it('appears when any piece is on Hold or Rejected', () => {
    expect(needsAttention(item({ statusCounts: { ON_HOLD: 1, DRAWING_READY: 49 } }))).toBe(true);
    expect(needsAttention(item({ statusCounts: { REJECTED: 2, DRAWING_READY: 48 } }))).toBe(true);
  });
  it('appears when any piece is Cancelled', () => {
    expect(needsAttention(item({ statusCounts: { CANCELLED: 1, DRAWING_READY: 49 } }))).toBe(true);
  });
  it('appears when confirmed pieces and generated pieces do not match, in either direction', () => {
    expect(attentionReasons(item({ confirmedPieces: 55, piecesGenerated: 50 }))).toEqual(['Drawing Confirmed Pieces is more than Pieces Generated']);
    expect(attentionReasons(item({ confirmedPieces: 40, piecesGenerated: 50 }))).toEqual(['Pieces Generated is more than Drawing Confirmed Pieces']);
  });
  it('appears when pieces are confirmed but none are generated yet', () => {
    expect(needsAttention(item({ confirmedPieces: 20, piecesGenerated: 0, statusCounts: {} }))).toBe(true);
  });
  it('stays off for an item Technical has not started (nothing confirmed, nothing generated)', () => {
    expect(needsAttention(item({ confirmedPieces: null, piecesGenerated: 0, statusCounts: {}, confirmations: [] }))).toBe(false);
  });
});

describe('contractTotals', () => {
  it('adds up every BOQ item', () => {
    const totals = contractTotals([
      item(),
      item({ boqItemId: 'i2', confirmedPieces: 10, piecesGenerated: 10, statusCounts: { PRODUCED: 2, DELIVERED: 3, ERECTED: 1, COMPLETED: 4 } }),
      item({ boqItemId: 'i3', confirmedPieces: null, piecesGenerated: 0, statusCounts: {}, confirmations: [] }),
    ]);
    expect(totals).toEqual({ confirmedPieces: 60, piecesGenerated: 60, releasedToProduction: 0, produced: 10, delivered: 9, erected: 11, completed: 8, needsAttention: 0 });
  });
  it('counts the items that need attention', () => {
    expect(contractTotals([item({ statusCounts: { ON_HOLD: 1 } }), item({ boqItemId: 'i2' })]).needsAttention).toBe(1);
  });
  it('has the seven total cards (Released to Production replaces Erected)', () => {
    expect(TOTAL_CARDS.map((c) => c.label)).toEqual(['Confirmed Pieces', 'Pieces Generated', 'Released to Production', 'Produced', 'Delivered', 'Completed', 'Needs Attention']);
  });
});

describe('empty states', () => {
  it('says Technical has not confirmed drawing pieces yet', () => {
    expect(itemStateMessage(item({ confirmedPieces: null, piecesGenerated: 0, statusCounts: {}, confirmations: [] }))).toBe(MESSAGES.noConfirmations);
  });
  it('says pieces have not been generated yet when confirmations exist but no pieces', () => {
    expect(itemStateMessage(item({ piecesGenerated: 0, statusCounts: {} }))).toBe(MESSAGES.notGenerated);
  });
  it('has no message once pieces exist', () => {
    expect(itemStateMessage(item())).toBeNull();
  });
  it('uses the plain wording', () => {
    expect(MESSAGES.noItems).toBe('No BOQ items found.');
    expect(MESSAGES.noPieces).toBe('No pieces found.');
    expect(MESSAGES.attentionHelp).toBe('Some pieces need review.');
  });
});

describe('contractQtyText', () => {
  it('shows Contract Qty with its unit', () => {
    expect(contractQtyText({ contractQty: '500.000', contractUnit: 'm²' })).toBe('500 M²');
    expect(contractQtyText({ contractQty: '50.000', contractUnit: 'nos' })).toBe('50 Nos');
    expect(contractQtyText({ contractQty: null, contractUnit: null })).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// FMP-BOQ-15 — Technical release
// ---------------------------------------------------------------------------

const groupItem = (over: Record<string, unknown> = {}) =>
  ({ boqItemId: 'i1', sortOrder: 1, description: 'x', piecesGenerated: 50, assignedToGroups: 40, notAssigned: 10, approvedPieces: 30, releasedToProduction: 25, groups: [], ...over }) as never;

describe('withTechnicalRelease', () => {
  it('adds assigned / not assigned / released / not released per BOQ item', () => {
    const [merged] = withTechnicalRelease([item()], [groupItem()]);
    expect(merged?.technical).toEqual({ assigned: 40, notAssigned: 10, released: 25, notReleased: 15 });
  });
  it('leaves technical empty when grouping data could not be loaded (no false claims)', () => {
    const [merged] = withTechnicalRelease([item()], null);
    expect(merged?.technical).toBeNull();
    expect(needsAttention(merged!)).toBe(false);
  });
});

describe('Needs Attention for Technical release', () => {
  const merged = (over: Record<string, unknown>) => withTechnicalRelease([item()], [groupItem(over)])[0]!;
  it('appears when generated pieces are not assigned to a group', () => {
    expect(attentionReasons(merged({ assignedToGroups: 45, notAssigned: 5, releasedToProduction: 45 }))).toEqual(['5 pieces not assigned']);
  });
  it('appears when assigned pieces are not released', () => {
    expect(attentionReasons(merged({ assignedToGroups: 50, notAssigned: 0, releasedToProduction: 40 }))).toEqual(['10 pieces not released']);
  });
  it('uses singular wording and combines with hold / rejected', () => {
    const m = withTechnicalRelease([item({ statusCounts: { ON_HOLD: 1, REJECTED: 1, DRAWING_READY: 48 } })], [groupItem({ assignedToGroups: 49, notAssigned: 1, releasedToProduction: 49 })])[0]!;
    expect(attentionReasons(m)).toEqual(['1 piece not assigned', '1 on hold', '1 rejected']);
  });
  it('is off when everything is assigned and released', () => {
    expect(needsAttention(merged({ assignedToGroups: 50, notAssigned: 0, releasedToProduction: 50 }))).toBe(false);
  });
  it('counts released pieces in the contract totals', () => {
    const a = merged({});
    expect(contractTotals([a]).releasedToProduction).toBe(25);
  });
});

describe('progress flow and notes', () => {
  it('runs Confirmed → Generated → Released → Produced → Delivered → Completed with counts', () => {
    const m = withTechnicalRelease([item()], [groupItem()])[0]!;
    expect(progressFlow(m).map((s) => `${s.label} ${s.count}`)).toEqual(['Confirmed 50', 'Generated 50', 'Released 25', 'Produced 8', 'Delivered 6', 'Completed 4']);
  });
  it('shows plain notes when no groups exist or nothing is released', () => {
    const none = withTechnicalRelease([item()], [groupItem({ assignedToGroups: 0, notAssigned: 50, releasedToProduction: 0 })])[0]!;
    expect(technicalReleaseNote(none, 0)).toBe('No drawing groups created yet.');
    expect(technicalReleaseNote(none, 2)).toBe('No pieces released to Production yet.');
    expect(technicalReleaseNote(withTechnicalRelease([item()], [groupItem()])[0]!, 2)).toBeNull();
    expect(MESSAGES.releaseHelp).toBe('Production can start only after Technical release.');
  });
  it('labels a piece Released / Not released / Not assigned', () => {
    expect(pieceReleaseLabel(undefined)).toBe('Not assigned');
    expect(pieceReleaseLabel({ status: 'APPROVED' })).toBe('Not released');
    expect(pieceReleaseLabel({ status: 'RELEASED_TO_PRODUCTION' })).toBe('Released to Production');
  });
});
