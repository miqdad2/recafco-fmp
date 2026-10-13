import { describe, it, expect } from 'vitest';
import type { BoqItemAttachment } from '@/lib/technical-api';
import {
  BOQ_FILE_MAX_BYTES,
  BOQ_FILE_TEXT,
  BOQ_REGISTER_TOTAL_MAX_BYTES,
  REGISTER_TOO_MANY_FILES_TEXT,
  boqAttachmentDownloadHref,
  boqAttachmentSourceLabel,
  boqAttachmentViewHref,
  boqItemLabel,
  filesAttachedText,
  groupAttachmentsByItem,
  mapStagedFilesToSavedItems,
  registerFilesTotalError,
  splitValidBoqFiles,
  validateBoqFile,
} from './boq-attachment-helpers';

describe('validateBoqFile', () => {
  it.each(['a.pdf', 'a.TIF', 'a.tiff', 'a.dwg', 'a.dxf', 'a.jpg', 'a.JPEG', 'a.png', 'a.xlsx', 'a.docx'])('allows %s', (name) => {
    expect(validateBoqFile({ name, size: 100 })).toBeNull();
  });

  it('rejects other types with a friendly message', () => {
    const message = validateBoqFile({ name: 'virus.exe', size: 100 });
    expect(message).toContain('virus.exe');
    expect(message).toContain('not allowed');
    expect(validateBoqFile({ name: 'noextension', size: 100 })).not.toBeNull();
  });

  it('rejects files over 25 MB and empty files', () => {
    expect(validateBoqFile({ name: 'a.pdf', size: BOQ_FILE_MAX_BYTES })).toBeNull();
    expect(validateBoqFile({ name: 'a.pdf', size: BOQ_FILE_MAX_BYTES + 1 })).toContain('too large');
    expect(validateBoqFile({ name: 'a.pdf', size: 0 })).toContain('empty');
  });

  it('splits a picked list, keeping the good files', () => {
    const result = splitValidBoqFiles([
      { name: 'a.pdf', size: 1 },
      { name: 'b.exe', size: 1 },
    ]);
    expect(result.valid.map((f) => f.name)).toEqual(['a.pdf']);
    expect(result.errors).toHaveLength(1);
  });
});

describe('labels and links', () => {
  it('labels an item by S/N, code and a shortened description', () => {
    expect(boqItemLabel({ sortOrder: 2, itemCode: null, description: 'Hollow core slab' })).toBe('2. Hollow core slab');
    expect(boqItemLabel({ sortOrder: 3, itemCode: 'HC-1', description: 'x'.repeat(100) })).toMatch(/^3\. HC-1 · x{57}…$/);
  });

  it('uses same-origin routes for view and download', () => {
    expect(boqAttachmentViewHref('c1', 'a1')).toBe('/technical/jobs/c1/boq-attachments/a1/open');
    expect(boqAttachmentDownloadHref('c1', 'a1')).toBe('/technical/jobs/c1/boq-attachments/a1/download');
  });

  it('names the source in plain words', () => {
    expect(boqAttachmentSourceLabel('CLIENT_INITIAL_DRAWING')).toBe('Client drawing');
    expect(boqAttachmentSourceLabel('TECHNICAL_REFERENCE')).toBe('Technical reference');
  });

  it('groups files by BOQ item', () => {
    const a = (id: string, boqItemId: string) => ({ id, boqItemId }) as BoqItemAttachment;
    const grouped = groupAttachmentsByItem([a('1', 'x'), a('2', 'y'), a('3', 'x')]);
    expect(grouped.get('x')?.map((f) => f.id)).toEqual(['1', '3']);
    expect(grouped.get('y')?.map((f) => f.id)).toEqual(['2']);
  });

  it('uses plain factory wording', () => {
    expect(BOQ_FILE_TEXT.attach).toBe('Attach Drawing / File');
    expect(BOQ_FILE_TEXT.addMore).toBe('Add more files');
    expect(Object.values(BOQ_FILE_TEXT).join(' ').toLowerCase()).not.toContain('bulk');
    expect(filesAttachedText(0)).toBe('No files attached');
    expect(filesAttachedText(1)).toBe('1 file attached');
    expect(filesAttachedText(3)).toBe('3 files attached');
    expect(BOQ_FILE_TEXT.add).toBe('Add Drawing / File');
    expect(BOQ_FILE_TEXT.noFiles).toBe('No files attached');
    expect(BOQ_FILE_TEXT.reference).toBe('Drawing files are for reference. Element quantity will be confirmed by Technical.');
  });
});

describe('New Contract Register file mapping', () => {
  it('maps each staged file to the position of its row among the saved rows', () => {
    // Row r2 is empty and not saved, so r3 becomes the 2nd saved item (position 1).
    expect(mapStagedFilesToSavedItems(['r1', 'r3', 'r1'], ['r1', 'r3'])).toEqual({ positions: [0, 1, 0], error: null });
  });

  it('maps ten files on one row to the same item', () => {
    const ids = Array.from({ length: 10 }, () => 'r1');
    expect(mapStagedFilesToSavedItems(ids, ['r1']).positions).toEqual(Array(10).fill(0));
  });

  it('asks the user to fill the row when a file sits on an empty row', () => {
    expect(mapStagedFilesToSavedItems(['r2'], ['r1'])).toEqual({ positions: null, error: BOQ_FILE_TEXT.needItemRow });
  });

  it('no files is fine — registering never needs a drawing', () => {
    expect(mapStagedFilesToSavedItems([], ['r1'])).toEqual({ positions: [], error: null });
  });
});

describe('register total size', () => {
  it('passes within the limit and explains when over it', () => {
    expect(registerFilesTotalError([{ size: BOQ_REGISTER_TOTAL_MAX_BYTES }])).toBeNull();
    expect(registerFilesTotalError([])).toBeNull();
    expect(registerFilesTotalError([{ size: BOQ_REGISTER_TOTAL_MAX_BYTES }, { size: 1 }])).toBe(REGISTER_TOO_MANY_FILES_TEXT);
  });
});

describe('drawing viewer helpers (FMP-TECH-19)', () => {
  it('decides what can be previewed', async () => {
    const { boqPreviewKind } = await import('./boq-attachment-helpers');
    expect(boqPreviewKind('a.PDF', 'application/pdf')).toBe('pdf');
    expect(boqPreviewKind('a.png', 'image/png')).toBe('image');
    expect(boqPreviewKind('a.jpeg', 'application/octet-stream')).toBe('image');
    expect(boqPreviewKind('a.tif', 'image/tiff')).toBe('tiff');
    expect(boqPreviewKind('a.TIFF', 'application/octet-stream')).toBe('tiff');
    expect(boqPreviewKind('a.dwg', 'application/acad')).toBe('unsupported');
    expect(boqPreviewKind('a.xlsx', 'application/vnd.ms-excel')).toBe('unsupported');
  });
  it('keeps zoom and rotation in range', async () => {
    const { stepBoqZoom, rotateBoq, BOQ_VIEWER_ZOOM } = await import('./boq-attachment-helpers');
    expect(stepBoqZoom(1, 'in')).toBeCloseTo(1.25);
    expect(stepBoqZoom(1, 'out')).toBeCloseTo(0.8);
    expect(stepBoqZoom(8, 'in')).toBe(BOQ_VIEWER_ZOOM.max);
    expect(stepBoqZoom(0.05, 'out')).toBe(BOQ_VIEWER_ZOOM.min);
    expect(rotateBoq(0, 'left')).toBe(270);
    expect(rotateBoq(270, 'right')).toBe(0);
    expect(rotateBoq(90, 'right')).toBe(180);
  });
});
