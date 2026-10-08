import { describe, it, expect } from 'vitest';
import { isTiffAttachment, TECHNICAL_ACCEPTED_FILE_TYPES_TEXT, drawingAttachmentViewHref, friendlyMissingLabels, isDrawingReceivedReady, DRAWING_RECEIVED_REQUIRED_FIELDS } from './attachment-helpers';

describe('attachment helpers (FMP-TECH-05)', () => {
  it('accepted text lists TIF/TIFF alongside existing types', () => {
    expect(TECHNICAL_ACCEPTED_FILE_TYPES_TEXT).toBe('Accepted: PDF, DOC/DOCX, XLS/XLSX, DWG/DXF, TIF/TIFF, JPG/PNG/WEBP');
  });

  it('detects TIFF attachments by extension or MIME type', () => {
    expect(isTiffAttachment({ originalFileName: 'a.TIF', mimeType: 'application/octet-stream' })).toBe(true);
    expect(isTiffAttachment({ originalFileName: 'a.tiff', mimeType: 'image/tiff' })).toBe(true);
    expect(isTiffAttachment({ originalFileName: 'a', mimeType: 'application/x-tiff' })).toBe(true);
  });

  it('does not flag other files', () => {
    expect(isTiffAttachment({ originalFileName: 'a.pdf', mimeType: 'application/pdf' })).toBe(false);
    expect(isTiffAttachment({ originalFileName: 'a.png', mimeType: 'image/png' })).toBe(false);
  });
});

describe('Drawing Received view link and required fields (FMP-TECH-06)', () => {
  it('view link targets the file-serving route, not the old missing /view page', () => {
    const href = drawingAttachmentViewHref('c1', 'a1');
    expect(href).toBe('/technical/jobs/c1/workflow/drawing-received/attachments/a1/open');
    expect(href.endsWith('/view')).toBe(false);
  });

  it('exactly 6 required fields', () => {
    expect(DRAWING_RECEIVED_REQUIRED_FIELDS.map((f) => f.label)).toEqual([
      'Received Date', 'Received From', 'Drawing Type', 'Drawing Reference No', 'Revision No', 'Number of Sheets',
    ]);
  });

  it('maps backend keys to friendly labels and never leaks raw keys or optional fields', () => {
    expect(friendlyMissingLabels(['receivedDate', 'drawingReferenceNo', 'plannedReviewStart', 'bogus'])).toEqual(['Received Date', 'Drawing Reference No']);
  });

  it('ready depends only on the 6 required fields (no attachments/optionals)', () => {
    const six = { receivedDate: '2026-09-01', receivedFrom: 'CLIENT', drawingType: 'MEP', drawingReferenceNo: 'D1', revisionNo: 'R0', numberOfSheets: 3 };
    expect(isDrawingReceivedReady(six)).toBe(true);
    expect(isDrawingReceivedReady({ ...six, revisionNo: '' })).toBe(false);
    expect(isDrawingReceivedReady(null)).toBe(false);
  });
});
