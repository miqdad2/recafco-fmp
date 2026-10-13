import { describe, it, expect } from 'vitest';
import type { ElementCoverageRow } from '@/lib/technical-api';
import {
  splitForRelease,
  drawingSourceLabel,
  waitingReason,
  groupDisplayName,
  formatReleaseTime,
  productionStatusText,
  releaseConfirmMessage,
  releaseBreakdown,
  PRODUCTION_RECEIVES_TEXT,
  RELEASE_SUCCESS_TEXT,
} from './release-page-helpers';

const group = (o: Partial<NonNullable<ElementCoverageRow['group']>> = {}) => ({ id: 'g1', drawingNo: 'HC-1', calculationRef: null, groupTitle: null, status: 'DRAFT' as const, fileCount: 1, ...o });
const el = (id: string, o: Partial<ElementCoverageRow> = {}): ElementCoverageRow => ({
  id, boqItemId: 'i1', boqItemSortOrder: 1, boqItemDescription: 'Beam', pieceNo: 1, pieceCode: `DN-${id}`, drawingNo: 'DN', currentStatus: 'DRAWING_READY',
  group: null, individualFileCount: 0, releasedToProductionAt: null, releasedAt: null, releasedByName: null, releasedVia: null, coverage: 'NONE', releaseState: 'WAITING', ...o,
});

describe('release page (FMP-TECH-31)', () => {
  it('splits elements into Ready to Release, Already Released and Waiting Final Drawing', () => {
    const rows = [el('a', { releaseState: 'READY', coverage: 'INDIVIDUAL' }), el('b', { releaseState: 'RELEASED' }), el('c'), el('d', { releaseState: 'READY', coverage: 'GROUP', group: group() })];
    const s = splitForRelease(rows);
    expect(s.ready.map((e) => e.id)).toEqual(['a', 'd']);
    expect(s.released.map((e) => e.id)).toEqual(['b']);
    expect(s.waiting.map((e) => e.id)).toEqual(['c']);
  });

  it('names the drawing source: Group Drawing or Individual Drawing (how it was released, once released)', () => {
    expect(drawingSourceLabel(el('a', { releaseState: 'READY', coverage: 'INDIVIDUAL' }))).toBe('Individual Drawing');
    expect(drawingSourceLabel(el('a', { releaseState: 'READY', coverage: 'GROUP', group: group() }))).toBe('Group Drawing');
    expect(drawingSourceLabel(el('a', { releaseState: 'RELEASED', releasedVia: 'GROUP', group: group() }))).toBe('Group Drawing');
    expect(drawingSourceLabel(el('a', { releaseState: 'RELEASED', releasedVia: 'INDIVIDUAL' }))).toBe('Individual Drawing');
  });

  it('says why an element is waiting', () => {
    expect(waitingReason(el('a'))).toBe('No final drawing uploaded');
    expect(waitingReason(el('a', { group: group({ fileCount: 0 }) }))).toBe('Group missing final drawing');
  });

  it('shows the group name, else its drawing reference, else a dash', () => {
    expect(groupDisplayName(el('a'))).toBe('—');
    expect(groupDisplayName(el('a', { group: group({ groupTitle: 'Zone A' }) }))).toBe('Zone A');
    expect(groupDisplayName(el('a', { group: group() }))).toBe('HC-1');
  });

  it('never invents release details: a missing time or person is a dash', () => {
    expect(formatReleaseTime(null)).toBe('—');
    expect(formatReleaseTime('not a date')).toBe('—');
    expect(formatReleaseTime('2026-10-13T08:30:00Z')).toMatch(/13 Oct 2026/);
  });

  it('shows the Production status, with DRAWING_READY meaning Production has not started', () => {
    expect(productionStatusText('DRAWING_READY')).toBe('Waiting for Production');
    expect(productionStatusText('IN_PRODUCTION')).toBe('In Production');
    expect(productionStatusText('PRODUCED')).toBe('Produced');
  });

  it('words the confirmation and the success message', () => {
    expect(releaseConfirmMessage(4)).toBe('You are releasing 4 elements to Production. Production will be able to start work on these elements.');
    expect(releaseConfirmMessage(1)).toMatch(/1 element to Production/);
    expect(RELEASE_SUCCESS_TEXT).toBe('Elements released to Production successfully.');
    expect(PRODUCTION_RECEIVES_TEXT).toBe('Production receives individual elements only after release from Technical.');
  });

  it('summarises a release per BOQ item for the confirmation', () => {
    const rows = [el('a'), el('b'), el('c', { boqItemSortOrder: 2, boqItemDescription: 'Slab' })];
    expect(releaseBreakdown(rows)).toEqual(['1. Beam — 2 elements', '2. Slab — 1 element']);
  });
});
