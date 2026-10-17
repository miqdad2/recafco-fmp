import { describe, it, expect } from 'vitest';
import type { BoqPieceStatus, ElementCoverageRow } from '@/lib/technical-api';
import {
  ELEMENT_FILTER_LABELS,
  ELEMENT_TEXT,
  completedText,
  elementDrawingStatus,
  elementStage,
  elementStatusLabel,
  itemStateMessage,
  matchesElementFilter,
  reasonText,
  summarizeContract,
  summarizeItem,
} from './boq-element-progress-helpers';
import type { ElementView } from './boq-element-progress-helpers';

type Release = ElementCoverageRow['releaseState'];
type Coverage = ElementCoverageRow['coverage'];

function row(code: string, status: BoqPieceStatus, releaseState: Release, coverage: Coverage, boqItemId = 'item-1'): ElementCoverageRow {
  return { id: code, boqItemId, pieceCode: code, currentStatus: status, releaseState, coverage } as unknown as ElementCoverageRow;
}

// The real "TEST ITEM" of CONTRACT-2026-000037 (dev data, audited 2026-10-15):
// 10 elements; 5 sit in a Submitted (not released) drawing group that has a file;
// 006 and 007 were released on their own and then produced / sent to storage;
// 008 was released on its own and is waiting for Production; 009 and 010 have their own
// final drawing but are not released yet.
const TEST_ITEM_ROWS: ElementCoverageRow[] = [
  ...['001', '002', '003', '004', '005'].map((n) => row(`DN-0001-${n}`, 'DRAWING_READY', 'READY', 'GROUP')),
  row('DN-0001-006', 'SENT_TO_STORAGE', 'RELEASED', 'INDIVIDUAL'),
  row('DN-0001-007', 'PRODUCED', 'RELEASED', 'INDIVIDUAL'),
  row('DN-0001-008', 'DRAWING_READY', 'RELEASED', 'INDIVIDUAL'),
  row('DN-0001-009', 'DRAWING_READY', 'READY', 'INDIVIDUAL'),
  row('DN-0001-010', 'DRAWING_READY', 'READY', 'INDIVIDUAL'),
];
const TEST_ITEM = { confirmedPieces: 10, piecesGenerated: 10, statusCounts: { DRAWING_READY: 8, PRODUCED: 1, SENT_TO_STORAGE: 1 } as Partial<Record<BoqPieceStatus, number>> };

describe('audit case: CONTRACT-2026-000037 "TEST ITEM"', () => {
  const s = summarizeItem(TEST_ITEM, TEST_ITEM_ROWS);
  const tile = (key: string): number | null | undefined => s.tiles.find((t) => t.key === key)?.count;

  it('counts the three individually released elements as released (the old page showed 0)', () => {
    expect(s.released).toBe(3);
  });

  it('shows where the ten elements are right now, nothing lost', () => {
    expect(tile('WAITING_RELEASE')).toBe(7); // 5 in the submitted group + 009 + 010
    expect(tile('WAITING_PRODUCTION')).toBe(1); // 008
    expect(tile('IN_PRODUCTION')).toBe(0);
    expect(tile('PRODUCED')).toBe(2); // 007 + 006 (sent to the Storage Yard) — the "2 produced" the old page showed
    expect(tile('IN_STORAGE')).toBe(0);
    const total = s.tiles.reduce((n, t) => n + (t.count ?? 0), 0);
    expect(total).toBe(10);
  });

  it('does not treat elements without a drawing group as a problem', () => {
    expect(s.needsAttention).toBe(false);
    expect(s.reasons.map((r) => r.key)).toEqual(['release', 'delivery']);
    expect(s.reasons.find((r) => r.key === 'release')?.count).toBe(7);
    expect(s.reasons.every((r) => r.tone === 'waiting')).toBe(true);
    expect(s.reasons.some((r) => /assigned/i.test(r.label))).toBe(false);
  });
});

describe('audit case: CONTRACT-2026-000013 "Hollowcore" (older records)', () => {
  // 10 of 140 elements moved on 2026-10-07, before the release rule existed, with no release record.
  const rows: ElementCoverageRow[] = [
    ...Array.from({ length: 130 }, (_, i) => row(`H-${i}`, 'DRAWING_READY', 'WAITING', 'NONE', 'h')),
    ...Array.from({ length: 5 }, (_, i) => row(`P-${i}`, 'IN_PRODUCTION', 'WAITING', 'NONE', 'h')),
    ...Array.from({ length: 2 }, (_, i) => row(`D-${i}`, 'PRODUCED', 'WAITING', 'NONE', 'h')),
    ...Array.from({ length: 2 }, (_, i) => row(`S-${i}`, 'IN_STORE', 'WAITING', 'NONE', 'h')),
    row('X-0', 'DELIVERED', 'WAITING', 'NONE', 'h'),
  ];
  const item = { confirmedPieces: 140, piecesGenerated: 140, statusCounts: { DRAWING_READY: 130, IN_PRODUCTION: 5, PRODUCED: 2, IN_STORE: 2, DELIVERED: 1 } as Partial<Record<BoqPieceStatus, number>> };
  const s = summarizeItem(item, rows);

  it('reports the ten older records instead of hiding them', () => {
    const reason = s.reasons.find((r) => r.key === 'noRelease');
    expect(reason).toMatchObject({ count: 10, tone: 'attention', filter: 'NO_RELEASE_RECORD' });
    expect(s.needsAttention).toBe(true);
    expect(s.released).toBe(0);
  });

  it('lists the missing final drawings as a next step, not a problem', () => {
    expect(s.reasons.find((r) => r.key === 'drawing')).toMatchObject({ count: 130, tone: 'waiting', filter: 'WAITING_DRAWING' });
  });
});

describe('reasons that need action', () => {
  it('flags hold, rejected and cancelled elements with their counts', () => {
    const s = summarizeItem({ confirmedPieces: 6, piecesGenerated: 6, statusCounts: { ON_HOLD: 2, REJECTED: 1, CANCELLED: 1, DRAWING_READY: 2 } }, null);
    expect(s.reasons.filter((r) => r.tone === 'attention').map((r) => [r.key, r.count])).toEqual([
      ['hold', 2], ['rejected', 1], ['cancelled', 1],
    ]);
    expect(s.needsAttention).toBe(true);
  });

  it('flags confirmed and generated elements that differ, in either direction', () => {
    expect(summarizeItem({ confirmedPieces: 10, piecesGenerated: 8, statusCounts: {} }, null).reasons[0]).toMatchObject({ key: 'mismatch', count: 2 });
    expect(summarizeItem({ confirmedPieces: 8, piecesGenerated: 10, statusCounts: {} }, null).reasons[0]).toMatchObject({ key: 'mismatch', count: 2 });
    expect(summarizeItem({ confirmedPieces: null, piecesGenerated: 0, statusCounts: {} }, null).reasons).toEqual([]);
  });

  it('adds delivery and erection as next steps', () => {
    const s = summarizeItem({ confirmedPieces: 5, piecesGenerated: 5, statusCounts: { IN_STORE: 2, SENT_TO_STORAGE: 1, DELIVERED: 2 } }, null);
    expect(s.reasons.map((r) => [r.key, r.count, r.tone])).toEqual([['delivery', 3, 'waiting'], ['erection', 2, 'waiting']]);
    expect(s.needsAttention).toBe(false);
  });

  it('writes counts in plain words', () => {
    expect(reasonText({ key: 'drawing', label: 'Final drawing missing', count: 1, tone: 'waiting', filter: null })).toBe('Final drawing missing: 1 element');
    expect(reasonText({ key: 'drawing', label: 'Final drawing missing', count: 3, tone: 'waiting', filter: null })).toBe('Final drawing missing: 3 elements');
  });
});

describe('when release details are not loaded', () => {
  const s = summarizeItem({ confirmedPieces: 4, piecesGenerated: 4, statusCounts: { DRAWING_READY: 4 } }, null);

  it('shows no invented release numbers', () => {
    expect(s.released).toBeNull();
    expect(s.tiles[0]).toMatchObject({ key: 'GENERATED', count: 4 });
    expect(s.reasons).toEqual([]);
  });

  it('cannot claim a missing final drawing or a missing release record', () => {
    const view: ElementView = { id: 'a', status: 'IN_PRODUCTION', releaseState: null, coverage: null };
    expect(matchesElementFilter(view, 'NO_RELEASE_RECORD')).toBe(false);
    expect(matchesElementFilter({ ...view, status: 'DRAWING_READY' }, 'WAITING_DRAWING')).toBe(false);
  });
});

describe('contract summary', () => {
  const items = [
    { boqItemId: 'item-1', ...TEST_ITEM },
    { boqItemId: 'item-2', confirmedPieces: 2, piecesGenerated: 2, statusCounts: { IN_PRODUCTION: 1, COMPLETED: 1 } as Partial<Record<BoqPieceStatus, number>> },
  ];
  const rows = [...TEST_ITEM_ROWS, row('B-1', 'IN_PRODUCTION', 'RELEASED', 'INDIVIDUAL', 'item-2'), row('B-2', 'COMPLETED', 'RELEASED', 'INDIVIDUAL', 'item-2')];
  const s = summarizeContract(items, rows);

  it('counts reached steps and current production separately', () => {
    expect(s).toMatchObject({ boqItems: 2, confirmed: 12, released: 5, inProduction: 1, produced: 3, delivered: 1, erected: 1, completed: 1 });
  });

  it('says release is unknown rather than 0 when coverage is not loaded', () => {
    expect(summarizeContract(items, null).released).toBeNull();
  });

  it('counts only items with something that needs action', () => {
    expect(s.itemsNeedingAttention).toBe(0);
    expect(summarizeContract([{ boqItemId: 'x', confirmedPieces: 3, piecesGenerated: 3, statusCounts: { ON_HOLD: 1 } }], null).itemsNeedingAttention).toBe(1);
  });
});

describe('element wording and filters', () => {
  it('names the holder and the status without internal codes', () => {
    expect(elementStage('DRAWING_READY', 'READY')).toBe('Technical');
    expect(elementStage('DRAWING_READY', 'RELEASED')).toBe('Production');
    expect(elementStage('SENT_TO_STORAGE', 'RELEASED')).toBe('Storage Yard & Delivery');
    expect(elementStage('ERECTED', 'RELEASED')).toBe('Erection');
    expect(elementStage('ON_HOLD', null)).toBe('Needs review');
    expect(elementStatusLabel('DRAWING_READY', 'WAITING')).toBe('Waiting for final drawing');
    expect(elementStatusLabel('DRAWING_READY', 'READY')).toBe('Waiting for Technical release');
    expect(elementStatusLabel('DRAWING_READY', 'RELEASED')).toBe('Waiting for Production');
    expect(elementStatusLabel('DRAWING_READY', null)).toBe('Elements Generated');
    expect(elementStatusLabel('ON_HOLD', 'RELEASED')).toBe('On Hold');
    expect(elementStatusLabel('IN_PRODUCTION', 'RELEASED')).toBe('In Production');
  });

  it('describes the drawing state', () => {
    expect(elementDrawingStatus('RELEASED', 'GROUP')).toBe('Released to Production');
    expect(elementDrawingStatus('READY', 'INDIVIDUAL')).toBe('Final drawing ready — not released');
    expect(elementDrawingStatus('WAITING', 'NONE')).toBe('Final drawing missing');
    expect(elementDrawingStatus(null, null)).toBe('—');
  });

  it('filters match the item numbers', () => {
    const views: ElementView[] = TEST_ITEM_ROWS.map((r) => ({ id: r.id, status: r.currentStatus, releaseState: r.releaseState, coverage: r.coverage }));
    const n = (key: Parameters<typeof matchesElementFilter>[1]): number => views.filter((v) => matchesElementFilter(v, key)).length;
    expect(n('ALL')).toBe(10);
    expect(n('WAITING_RELEASE')).toBe(7);
    expect(n('WAITING_PRODUCTION')).toBe(1);
    expect(n('IN_STORAGE')).toBe(0);
    expect(n('DELIVERY_PENDING')).toBe(1);
    expect(n('PRODUCED')).toBe(2);
    expect(n('WAITING_DRAWING')).toBe(0);
    expect(n('NO_RELEASE_RECORD')).toBe(0);
  });

  it('uses Element wording only', () => {
    const all = [...Object.values(ELEMENT_FILTER_LABELS), ...Object.values(ELEMENT_TEXT)].join(' ');
    expect(all).not.toMatch(/\bpieces?\b/i);
    expect(ELEMENT_TEXT.subtitle).toBe('Track BOQ items and individual elements from Technical through Production, Delivery and Erection.');
  });

  it('reports progress and empty states', () => {
    expect(completedText({ confirmedPieces: 10, piecesGenerated: 10, statusCounts: { COMPLETED: 4 } })).toMatchObject({ text: '4 of 10 completed', percent: 40 });
    expect(itemStateMessage({ confirmedPieces: null, piecesGenerated: 0, statusCounts: {} })).toBe(ELEMENT_TEXT.notConfirmed);
    expect(itemStateMessage({ confirmedPieces: 3, piecesGenerated: 0, statusCounts: {} })).toBe(ELEMENT_TEXT.notGenerated);
    expect(itemStateMessage({ confirmedPieces: 3, piecesGenerated: 3, statusCounts: {} })).toBeNull();
  });
});
