import { describe, it, expect } from 'vitest';
import type { ProductionPiece } from '@/lib/production-pieces-api';
import {
  drawingBadge,
  canViewDrawingFiles,
  drawingSummaryText,
  selectedNotReleasedCount,
  shouldWarnNotReleased,
  targetNeedsRelease,
  PRODUCTION_DRAWING_TEXT,
} from './production-drawing-helpers';

const released = { released: true as const, drawingNo: 'HC-001', calculationRef: 'CALC-001', groupTitle: 'Zone A', fileCount: 2 };
const notReleased = { released: false as const };
const piece = (id: string, drawingGroup: ProductionPiece['drawingGroup']): Pick<ProductionPiece, 'id' | 'drawingGroup'> => ({ id, drawingGroup });

describe('drawingBadge', () => {
  it('a piece with no group says "No drawing group"', () => {
    expect(drawingBadge(null)).toEqual({ label: 'No drawing group', tone: 'none', short: null });
  });
  it('an unreleased group says "Not released to Production"', () => {
    expect(drawingBadge(notReleased)).toEqual({ label: 'Not released to Production', tone: 'not-released', short: 'Not released' });
  });
  it('a released group says "Released to Production"', () => {
    expect(drawingBadge(released)).toEqual({ label: 'Released to Production', tone: 'released', short: 'Released' });
  });
});

describe('View Files', () => {
  it('is available only for a released group', () => {
    expect(canViewDrawingFiles(released)).toBe(true);
    expect(canViewDrawingFiles(notReleased)).toBe(false);
    expect(canViewDrawingFiles(null)).toBe(false);
  });
  it('summarises a released group with drawing no, calculation ref and file count — nothing for the others', () => {
    expect(drawingSummaryText(released)).toBe('HC-001 · CALC-001 · 2 files');
    expect(drawingSummaryText({ ...released, calculationRef: null, fileCount: 1 })).toBe('HC-001 · 1 file');
    expect(drawingSummaryText({ ...released, fileCount: 0 })).toBe('HC-001 · CALC-001 · No files attached.');
    expect(drawingSummaryText(notReleased)).toBe('');
    expect(drawingSummaryText(null)).toBe('');
  });
});

describe('optional warning (never blocks)', () => {
  const pieces = [piece('a', released), piece('b', notReleased), piece('c', null)];
  it('counts the selected pieces that are not released (including no group)', () => {
    expect(selectedNotReleasedCount(pieces, new Set(['a']))).toBe(0);
    expect(selectedNotReleasedCount(pieces, new Set(['a', 'b', 'c']))).toBe(2);
    expect(selectedNotReleasedCount(pieces, new Set())).toBe(0);
  });
  it('warns only when marking In Production or Produced', () => {
    expect(shouldWarnNotReleased('IN_PRODUCTION', 2)).toBe(true);
    expect(shouldWarnNotReleased('PRODUCED', 1)).toBe(true);
    expect(shouldWarnNotReleased('ON_HOLD', 2)).toBe(false);
    expect(shouldWarnNotReleased('', 2)).toBe(false);
    expect(shouldWarnNotReleased('PRODUCED', 0)).toBe(false);
    expect(PRODUCTION_DRAWING_TEXT.warning).toBe('Some selected pieces are not released to Production and will be skipped.');
    expect(PRODUCTION_DRAWING_TEXT.helper).toBe('Only released pieces can be marked In Production or Produced.');
    expect(targetNeedsRelease('ON_HOLD')).toBe(false);
    expect(targetNeedsRelease('REJECTED')).toBe(false);
    expect(targetNeedsRelease('PRODUCED')).toBe(true);
  });
});
