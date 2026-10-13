import { describe, it, expect } from 'vitest';
import type { BoqPieceUpdateStatus } from '@/lib/technical-api';
import {
  PRODUCTION_ACTIONS,
  PRODUCTION_STATUS_LABELS,
  actionMessage,
  bulkActionsFor,
  buildActionNote,
  drawingLineText,
  productionDrawingHrefs,
  showsMissingDrawing,
  startConfirmation,
  historyEventText,
  lastUpdateInfo,
  resultMessage,
  rowActionsFor,
  todayInputValue,
  validateActionForm,
} from './production-work-helpers';

const ALL: BoqPieceUpdateStatus[] = ['IN_PRODUCTION', 'PRODUCED', 'SENT_TO_STORAGE', 'ON_HOLD', 'REJECTED'];
const d = (hasDrawing: boolean) => ({ status: 'DRAWING_READY' as const, hasDrawing });
const labels = (list: { label: string }[]): string[] => list.map((a) => a.label);

describe('production status wording', () => {
  it('never shows the Technical wording "Elements Generated"', () => {
    expect(PRODUCTION_STATUS_LABELS.DRAWING_READY).toBe('Ready for Production');
    expect(Object.values(PRODUCTION_STATUS_LABELS)).not.toContain('Elements Generated');
  });
  it('has the Sent to Storage Yard status', () => {
    expect(PRODUCTION_STATUS_LABELS.SENT_TO_STORAGE).toBe('Sent to Storage Yard');
  });
});

describe('rowActionsFor', () => {
  it('Ready for Production → Start Production', () => {
    expect(labels(rowActionsFor('DRAWING_READY', ALL))).toEqual(['Start Production']);
  });
  it('In Production → Mark Produced, Put On Hold, Reject', () => {
    expect(labels(rowActionsFor('IN_PRODUCTION', ALL))).toEqual(['Mark Produced', 'Put On Hold', 'Reject']);
  });
  it('Produced → Send to Storage Yard', () => {
    expect(labels(rowActionsFor('PRODUCED', ALL))).toEqual(['Send to Storage Yard']);
  });
  it('On Hold → Resume Production, Reject', () => {
    expect(labels(rowActionsFor('ON_HOLD', ALL))).toEqual(['Resume Production', 'Reject']);
  });
  it('Rejected and Sent to Storage Yard → History only (no actions)', () => {
    expect(rowActionsFor('REJECTED', ALL)).toEqual([]);
    expect(rowActionsFor('SENT_TO_STORAGE', ALL)).toEqual([]);
  });
  it('view-only users (no allowed statuses, or unresolved) get no buttons at all', () => {
    expect(rowActionsFor('DRAWING_READY', [])).toEqual([]);
    expect(rowActionsFor('IN_PRODUCTION', null)).toEqual([]);
  });
  it('only offers actions whose target status the user may set', () => {
    expect(labels(rowActionsFor('IN_PRODUCTION', ['PRODUCED']))).toEqual(['Mark Produced']);
  });
});

describe('bulkActionsFor', () => {
  it('all Ready → Start Production', () => {
    expect(labels(bulkActionsFor([d(true), d(true)], ALL))).toEqual(['Start Production']);
  });
  it('all In Production → Mark Produced and Put On Hold', () => {
    expect(labels(bulkActionsFor([{ status: 'IN_PRODUCTION', hasDrawing: true }], ALL))).toEqual(['Mark Produced', 'Put On Hold']);
  });
  it('all Produced → Send to Storage Yard', () => {
    expect(labels(bulkActionsFor([{ status: 'PRODUCED', hasDrawing: true }, { status: 'PRODUCED', hasDrawing: true }], ALL))).toEqual(['Send to Storage Yard']);
  });
  it('mixed statuses → no bulk action', () => {
    expect(bulkActionsFor([d(true), { status: 'PRODUCED', hasDrawing: true }], ALL)).toEqual([]);
  });
  it('nothing selected, or a read-only user → none', () => {
    expect(bulkActionsFor([], ALL)).toEqual([]);
    expect(bulkActionsFor([{ status: 'PRODUCED', hasDrawing: true }], [])).toEqual([]);
  });
});

describe('modal wording', () => {
  it('matches the requested titles and messages', () => {
    expect(PRODUCTION_ACTIONS.START.modalTitle).toBe('Start Production?');
    expect(PRODUCTION_ACTIONS.PRODUCE.modalTitle).toBe('Mark as Produced?');
    expect(PRODUCTION_ACTIONS.SEND.modalTitle).toBe('Send to Storage Yard?');
    expect(actionMessage(PRODUCTION_ACTIONS.START, 3)).toBe('You are starting production for 3 elements.');
    expect(actionMessage(PRODUCTION_ACTIONS.START, 1)).toBe('You are starting production for 1 element.');
    expect(actionMessage(PRODUCTION_ACTIONS.SEND, 1)).toBe('This element will move to Storage Yard & Delivery. Storage team will be able to receive and manage it.');
    expect(actionMessage(PRODUCTION_ACTIONS.SEND, 2)).toBe('These 2 elements will move to Storage Yard & Delivery. Storage team will be able to receive and manage them.');
  });
});

describe('form + note', () => {
  it('Produced date must be a date and not in the future', () => {
    const a = PRODUCTION_ACTIONS.PRODUCE;
    expect(validateActionForm(a, { producedDate: '', text: '' }, '2026-10-14')).toBe('Please enter the produced date.');
    expect(validateActionForm(a, { producedDate: '2026-10-15', text: '' }, '2026-10-14')).toBe('Produced date cannot be in the future.');
    expect(validateActionForm(a, { producedDate: '2026-10-14', text: '' }, '2026-10-14')).toBeNull();
  });
  it('other actions need no date', () => {
    expect(validateActionForm(PRODUCTION_ACTIONS.START, { producedDate: '', text: '' })).toBeNull();
  });
  it('builds the history note', () => {
    expect(buildActionNote(PRODUCTION_ACTIONS.PRODUCE, { producedDate: '2026-10-14', text: ' ok ' })).toBe('Produced on 2026-10-14 · ok');
    expect(buildActionNote(PRODUCTION_ACTIONS.SEND, { producedDate: '', text: '' })).toBe('Handed over to Storage Yard & Delivery');
    expect(buildActionNote(PRODUCTION_ACTIONS.START, { producedDate: '', text: '' })).toBe('');
  });
  it('todayInputValue is yyyy-mm-dd', () => {
    expect(todayInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('result message', () => {
  it('is plain when everything updated and the API text when some were skipped', () => {
    expect(resultMessage(PRODUCTION_ACTIONS.SEND, 3, 'Elements updated.', 0)).toBe('3 elements sent to Storage Yard successfully.');
    expect(resultMessage(PRODUCTION_ACTIONS.SEND, 2, '2 elements updated. 1 element skipped.', 1)).toBe('2 elements updated. 1 element skipped.');
  });
});

describe('row details', () => {
  it('reads the latest update', () => {
    expect(lastUpdateInfo({ statusHistory: [] })).toBeNull();
    expect(lastUpdateInfo({ statusHistory: [{ newStatus: 'REJECTED' as const, note: 'Cracked', createdAt: 'x', updatedByUser: { displayName: 'Sam' } }] })).toEqual({ by: 'Sam', note: 'Cracked' });
  });
  it('describes the drawing source, reference and file count', () => {
    expect(drawingLineText({ source: 'INDIVIDUAL', reference: 'DN-0001', groupTitle: null, fileCount: 1, hasDrawing: true })).toBe('Drawing DN-0001 · Individual Drawing · 1 file');
    expect(drawingLineText({ source: 'GROUP', reference: '8888', groupTitle: 'hc-zone A', fileCount: 1, hasDrawing: true })).toBe('Group: hc-zone A · Drawing 8888 · 1 file');
    expect(drawingLineText({ source: 'GROUP', reference: '8888', groupTitle: null, fileCount: 3, hasDrawing: true })).toBe('Group Drawing · Drawing 8888 · 3 files');
    expect(drawingLineText({ source: 'NONE', reference: 'DN-1', groupTitle: null, fileCount: 0, hasDrawing: false })).toBe('No final drawing');
  });
});

describe('final drawing protection (FMP-PROD-03)', () => {
  const none = { source: 'NONE' as const, reference: 'D', groupTitle: null, fileCount: 0, hasDrawing: false };
  const some = { source: 'INDIVIDUAL' as const, reference: 'D', groupTitle: null, fileCount: 1, hasDrawing: true };

  it('Start Production is not offered without a final drawing', () => {
    expect(rowActionsFor('DRAWING_READY', ALL, false)).toEqual([]);
    expect(labels(rowActionsFor('DRAWING_READY', ALL, true))).toEqual(['Start Production']);
  });
  it('other actions do not depend on the drawing', () => {
    expect(labels(rowActionsFor('IN_PRODUCTION', ALL, false))).toEqual(['Mark Produced', 'Put On Hold', 'Reject']);
  });
  it('bulk Start Production needs every ticked element to have a drawing', () => {
    expect(labels(bulkActionsFor([d(true), d(true)], ALL))).toEqual(['Start Production']);
    expect(bulkActionsFor([d(true), d(false)], ALL)).toEqual([]);
  });
  it('shows Missing Drawing only for an element that has not started', () => {
    expect(showsMissingDrawing({ currentStatus: 'DRAWING_READY', drawing: none })).toBe(true);
    expect(showsMissingDrawing({ currentStatus: 'DRAWING_READY', drawing: some })).toBe(false);
    expect(showsMissingDrawing({ currentStatus: 'IN_PRODUCTION', drawing: none })).toBe(false);
  });
  it('asks the user to confirm the drawing was checked', () => {
    expect(startConfirmation(1)).toEqual({
      message: 'You are starting production for this element. Please confirm the final drawing has been checked.',
      checkbox: 'I checked the final drawing.',
    });
    expect(startConfirmation(3)).toEqual({ message: 'You are starting production for 3 elements. Confirm drawings have been checked.', checkbox: 'I checked the drawings.' });
  });
  it('the viewer and Download Drawing use the Production same-origin routes', () => {
    expect(productionDrawingHrefs('p1', 'f1')).toEqual({
      view: '/production/pieces/p1/drawing-files/f1/view',
      preview: '/production/pieces/p1/drawing-files/f1/preview',
      download: '/production/pieces/p1/drawing-files/f1/download',
    });
  });
});

describe('history wording', () => {
  it('uses plain event names', () => {
    expect(historyEventText(null, 'DRAWING_READY', 'Released from Technical')).toBe('Released from Technical');
    expect(historyEventText('DRAWING_READY', 'IN_PRODUCTION', null)).toBe('Started Production');
    expect(historyEventText('ON_HOLD', 'IN_PRODUCTION', null)).toBe('Resumed Production');
    expect(historyEventText('IN_PRODUCTION', 'PRODUCED', null)).toBe('Marked Produced');
    expect(historyEventText('PRODUCED', 'SENT_TO_STORAGE', null)).toBe('Sent to Storage Yard');
    expect(historyEventText('IN_PRODUCTION', 'ON_HOLD', null)).toBe('Put On Hold');
    expect(historyEventText('IN_PRODUCTION', 'REJECTED', null)).toBe('Rejected');
  });
});

// ---------------------------------------------------------------------------
// FMP-PROD-04
// ---------------------------------------------------------------------------

import type { ProductionPiece } from '@/lib/production-pieces-api';
import {
  formatMilestoneDate,
  historyLine,
  mergeRetained,
  milestoneInfo,
  retainUpdated,
  showsDrawingButtons,
  statusFilterHref,
  targetFilterFor,
} from './production-work-helpers';

const hist = (newStatus: ProductionPiece['currentStatus'], at: string, by: string | null) => ({ newStatus, note: null, createdAt: at, updatedByUser: by ? { displayName: by } : null });
const makePiece = (over: Partial<ProductionPiece> = {}): ProductionPiece =>
  ({
    id: 'a', pieceCode: 'DN-0001-007', currentStatus: 'IN_PRODUCTION', updatedAt: '2026-10-13T12:00:00.000Z', statusHistory: [],
    drawing: { source: 'INDIVIDUAL', reference: 'DN-0001', groupTitle: null, fileCount: 1, hasDrawing: true },
    ...over,
  }) as unknown as ProductionPiece;

describe('single-element success messages', () => {
  it('say what happened to the element', () => {
    expect(resultMessage(PRODUCTION_ACTIONS.PRODUCE, 1, undefined, 0)).toBe('Element marked as Produced.');
    expect(resultMessage(PRODUCTION_ACTIONS.SEND, 1, undefined, 0)).toBe('Element sent to Storage Yard successfully.');
    expect(resultMessage(PRODUCTION_ACTIONS.PRODUCE, 3, undefined, 0)).toBe('3 elements marked as Produced.');
  });
});

describe('Produced / Sent details', () => {
  it('reads Produced on/by and Sent on/by from the latest status changes', () => {
    const p = makePiece({
      currentStatus: 'SENT_TO_STORAGE',
      statusHistory: [hist('SENT_TO_STORAGE', '2026-10-13T12:20:00.000Z', 'manager'), hist('PRODUCED', '2026-10-13T12:15:00.000Z', 'manager')],
    });
    expect(milestoneInfo(p)).toEqual({
      produced: { at: '2026-10-13T12:15:00.000Z', by: 'manager' },
      sent: { at: '2026-10-13T12:20:00.000Z', by: 'manager' },
    });
  });
  it('has neither before the element is produced', () => {
    expect(milestoneInfo(makePiece())).toEqual({ produced: null, sent: null });
  });
  it('formats the date like "13 Oct 2026, 12:15" and builds history lines', () => {
    expect(formatMilestoneDate('2026-10-13T12:15:00')).toMatch(/^13 Oct 2026,? 12:15$/);
    expect(historyLine('Marked Produced', 'manager', '2026-10-13T12:15:00')).toMatch(/^Marked Produced by manager on 13 Oct 2026,? 12:15$/);
    expect(historyLine('Released from Technical', null, null)).toBe('Released from Technical');
  });
});

describe('button visibility by status', () => {
  it('hides drawing buttons on On Hold and Rejected rows only', () => {
    expect(showsDrawingButtons('PRODUCED')).toBe(true);
    expect(showsDrawingButtons('SENT_TO_STORAGE')).toBe(true);
    expect(showsDrawingButtons('ON_HOLD')).toBe(false);
    expect(showsDrawingButtons('REJECTED')).toBe(false);
  });
  it('Produced shows Send to Storage Yard and never Mark Produced again', () => {
    expect(labels(rowActionsFor('PRODUCED', ALL))).toEqual(['Send to Storage Yard']);
  });
});

describe('elements stay visible after an update', () => {
  it('keeps the updated element with its new status, who and when', () => {
    const kept = retainUpdated([makePiece()], ['a'], PRODUCTION_ACTIONS.PRODUCE, 'ok', 'manager', '2026-10-13T12:15:00.000Z');
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ currentStatus: 'PRODUCED', updatedAt: '2026-10-13T12:15:00.000Z' });
    expect(milestoneInfo(kept[0]!).produced).toEqual({ at: '2026-10-13T12:15:00.000Z', by: 'manager' });
  });
  it('adds a kept element the filtered list no longer returns, in element code order', () => {
    const kept = retainUpdated([makePiece()], ['a'], PRODUCTION_ACTIONS.PRODUCE, '', null, '2026-10-13T12:15:00.000Z');
    const merged = mergeRetained([makePiece({ id: 'b', pieceCode: 'DN-0001-001' })], kept);
    expect(merged.map((p) => p.pieceCode)).toEqual(['DN-0001-001', 'DN-0001-007']);
  });
  it('prefers the kept element while the reload still shows the old status, and the reloaded one once it matches', () => {
    const kept = retainUpdated([makePiece()], ['a'], PRODUCTION_ACTIONS.PRODUCE, '', null, '2026-10-13T12:15:00.000Z');
    expect(mergeRetained([makePiece()], kept)[0]!.currentStatus).toBe('PRODUCED');
    const reloaded = makePiece({ currentStatus: 'PRODUCED', updatedAt: '2026-10-13T12:15:01.000Z' });
    expect(mergeRetained([reloaded], kept)[0]).toBe(reloaded);
  });
  it('points to the filter the element now belongs to', () => {
    expect(targetFilterFor(PRODUCTION_ACTIONS.PRODUCE)).toEqual({ value: 'PRODUCED', label: 'View Produced Elements' });
    expect(statusFilterHref('PRODUCED', 'c1')).toBe('/production/pieces?status=PRODUCED&contractId=c1');
    expect(statusFilterHref('PRODUCED', '')).toBe('/production/pieces?status=PRODUCED');
  });
});
