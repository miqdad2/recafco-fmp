import { describe, it, expect } from 'vitest';
import { BOQ_FILE_TYPES_TEXT } from './boq-attachment-helpers';
import type { GroupablePiece } from '@/lib/technical-api';
import {
  DRAWING_GROUP_STATUS_LABELS,
  GROUP_ACTION_LABELS,
  validateGroupForm,
  pieceGroupLabel,
  filterPiecesByCode,
  isPieceSelectable,
  toggleVisible,
  GROUP_FILE_CATEGORY_LABELS,
  validateGroupUpload,
  GROUP_FILE_ACCEPT,
  GROUP_FILE_CATEGORY_OPTIONS,
  GROUP_FILE_DEFAULT_CATEGORY,
  formatFileSize,
  canChangeGroupFiles,
  groupFilesLockedMessage,
  fileCountLabel,
  pieceGroupFileCount,
  GROUP_FILE_MAX_BYTES,
} from './drawing-group-helpers';

const piece = (id: string, code: string, group?: { id: string; drawingNo: string; calculationRef: string | null }): GroupablePiece => ({
  id,
  pieceNo: 1,
  pieceCode: code,
  currentStatus: 'DRAWING_READY',
  drawingGroupLinks: group ? [{ group: { ...group, status: 'DRAFT' } }] : [],
});

describe('labels', () => {
  it('uses the approved status labels', () => {
    expect(DRAWING_GROUP_STATUS_LABELS).toEqual({
      DRAFT: 'Draft',
      SUBMITTED: 'Submitted',
      APPROVED: 'Approved',
      RELEASED_TO_PRODUCTION: 'Released to Production',
      REVISED: 'Revised',
      CANCELLED: 'Cancelled',
    });
  });
  it('has simple action wording', () => {
    expect(GROUP_ACTION_LABELS.RELEASE).toBe('Release to Production');
    expect(GROUP_ACTION_LABELS.APPROVE).toBe('Approve');
  });
});

describe('validateGroupForm', () => {
  it('asks for BOQ item and drawing number in plain words', () => {
    expect(validateGroupForm({ boqItemId: '', drawingNo: ' ', selectedCount: 3 }, false)).toEqual({
      boqItemId: 'Please select BOQ item.',
      drawingNo: 'Please enter drawing number.',
    });
  });
  it('lets a draft be saved with no elements but not a submit', () => {
    expect(validateGroupForm({ boqItemId: 'i', drawingNo: 'HC-1', selectedCount: 0 }, false)).toEqual({});
    expect(validateGroupForm({ boqItemId: 'i', drawingNo: 'HC-1', selectedCount: 0 }, true)).toEqual({ pieces: 'Please select at least one element.' });
    expect(validateGroupForm({ boqItemId: 'i', drawingNo: 'HC-1', selectedCount: 2 }, true)).toEqual({});
  });
});

describe('piece group display', () => {
  it('shows "Not Assigned to Group" when a piece is in no group', () => {
    expect(pieceGroupLabel({ drawingGroupLinks: [] })).toBe('Not Assigned to Group');
    expect(pieceGroupLabel({})).toBe('Not Assigned to Group');
  });
  it('shows drawing no and calculation ref of the group', () => {
    expect(pieceGroupLabel(piece('a', 'HC-001-001', { id: 'g', drawingNo: 'HC-001', calculationRef: 'CALC-001' }))).toBe('HC-001 · CALC-001');
    expect(pieceGroupLabel(piece('a', 'HC-001-001', { id: 'g', drawingNo: 'HC-001', calculationRef: null }))).toBe('HC-001');
  });
});

describe('piece picker', () => {
  const pieces = [
    piece('1', 'HC-001-001'),
    piece('2', 'HC-001-002', { id: 'other', drawingNo: 'HC-009', calculationRef: null }),
    piece('3', 'HC-001-003', { id: 'mine', drawingNo: 'HC-001', calculationRef: null }),
  ];
  it('searches by piece code, ignoring case', () => {
    expect(filterPiecesByCode(pieces, 'hc-001-002').map((p) => p.id)).toEqual(['2']);
    expect(filterPiecesByCode(pieces, '  ')).toHaveLength(3);
  });
  it('a piece in another active group is not selectable; one in the group being edited is', () => {
    expect(isPieceSelectable(pieces[0]!, null)).toBe(true);
    expect(isPieceSelectable(pieces[1]!, 'mine')).toBe(false);
    expect(isPieceSelectable(pieces[2]!, 'mine')).toBe(true);
    expect(isPieceSelectable(pieces[2]!, null)).toBe(false);
  });
  it('select all visible toggles only the selectable visible pieces', () => {
    const selectable = pieces.filter((p) => isPieceSelectable(p, 'mine'));
    const on = toggleVisible(new Set(), selectable);
    expect([...on].sort()).toEqual(['1', '3']);
    expect(toggleVisible(on, selectable).size).toBe(0);
    expect(toggleVisible(new Set(['x']), []).has('x')).toBe(true);
  });
});

describe('group files (FMP-BOQ-12)', () => {
  it('has the four approved categories', () => {
    expect(GROUP_FILE_CATEGORY_LABELS).toEqual({ DRAWING: 'Drawing', CALCULATION: 'Calculation', APPROVAL_DOCUMENT: 'Approval Document', OTHER: 'Other' });
  });
  it('asks for a file, then a category, in plain words', () => {
    expect(validateGroupUpload(null, 'DRAWING')).toBe('Please select a file.');
    expect(validateGroupUpload({ name: 'a.pdf', size: 1 }, '')).toBe('Please select file category.');
  });
  it('allows PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word and Excel; rejects other types and big files (FMP-TECH-28)', () => {
    for (const name of ['a.pdf', 'a.DOCX', 'a.xls', 'a.xlsx', 'a.png', 'a.jpg', 'a.jpeg', 'a.doc', 'a.tif', 'a.TIFF', 'a.dwg', 'a.DXF']) {
      expect(validateGroupUpload({ name, size: 10 }, 'DRAWING')).toBeNull();
    }
    const refused = 'This file type is not allowed. Please upload PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word, or Excel.';
    expect(validateGroupUpload({ name: 'a.exe', size: 10 }, 'DRAWING')).toBe(refused);
    expect(validateGroupUpload({ name: 'noext', size: 10 }, 'DRAWING')).toBe(refused);
    expect(validateGroupUpload({ name: 'a.pdf', size: GROUP_FILE_MAX_BYTES + 1 }, 'DRAWING')).toBe('File is too large.');
  });
  it('uses one accepted list and one helper text everywhere a Technical drawing is uploaded', () => {
    expect(GROUP_FILE_ACCEPT).toBe('.pdf,.tif,.tiff,.dwg,.dxf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.doc,.docx');
    expect(BOQ_FILE_TYPES_TEXT).toBe('Accepted files: PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word, or Excel. Maximum 25 MB each.');
  });
  it('offers Drawing (default), Calculation and Other for new uploads', () => {
    expect(GROUP_FILE_CATEGORY_OPTIONS.map((o) => o.label)).toEqual(['Drawing', 'Calculation', 'Other']);
    expect(GROUP_FILE_DEFAULT_CATEGORY).toBe('DRAWING');
  });
  it('formats sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('files can change in Draft/Submitted/Approved only; released groups show the plain message', () => {
    expect(canChangeGroupFiles('DRAFT')).toBe(true);
    expect(canChangeGroupFiles('APPROVED')).toBe(true);
    expect(canChangeGroupFiles('RELEASED_TO_PRODUCTION')).toBe(false);
    expect(groupFilesLockedMessage('RELEASED_TO_PRODUCTION')).toBe('Released groups cannot be changed.');
    expect(groupFilesLockedMessage('CANCELLED')).toBe('This group cannot be changed.');
    expect(groupFilesLockedMessage('DRAFT')).toBeNull();
  });
  it('warns when a group has no files, otherwise shows the count', () => {
    expect(fileCountLabel(0)).toBe('No files attached.');
    expect(fileCountLabel(1)).toBe('1 file');
    expect(fileCountLabel(4)).toBe('4 files');
  });
  it('reads the file count of a piece group (0 when not assigned)', () => {
    expect(pieceGroupFileCount({ drawingGroupLinks: [] })).toBe(0);
    expect(pieceGroupFileCount({})).toBe(0);
    expect(
      pieceGroupFileCount({ drawingGroupLinks: [{ group: { id: 'g', drawingNo: 'HC-1', calculationRef: null, groupTitle: null, status: 'DRAFT', _count: { attachments: 3 } } }] }),
    ).toBe(3);
  });
});

describe('element range selection (FMP-TECH-24)', () => {
  const els = [
    { id: 'a', pieceNo: 1, pieceCode: 'X-001', currentStatus: 'DRAWING_READY', drawingGroupLinks: [] },
    { id: 'b', pieceNo: 2, pieceCode: 'X-002', currentStatus: 'DRAWING_READY', drawingGroupLinks: [{ group: { id: 'other', drawingNo: 'D', calculationRef: null, status: 'DRAFT' } }] },
    { id: 'c', pieceNo: 3, pieceCode: 'X-003', currentStatus: 'DRAWING_READY', drawingGroupLinks: [] },
    { id: 'd', pieceNo: 4, pieceCode: 'X-004', currentStatus: 'DRAWING_READY', drawingGroupLinks: [] },
  ] as unknown as GroupablePiece[];

  it('picks the unassigned elements in the range, in either order', async () => {
    const { selectableIdsInRange } = await import('./drawing-group-helpers');
    expect(selectableIdsInRange(els, 1, 3, null)).toEqual(['a', 'c']);
    expect(selectableIdsInRange(els, 3, 1, null)).toEqual(['a', 'c']);
    expect(selectableIdsInRange(els, 4, 9, null)).toEqual(['d']);
    expect(selectableIdsInRange(els, 2, 2, 'other')).toEqual(['b']);
  });
});
