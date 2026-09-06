import { describe, it, expect } from 'vitest';
import {
  ATTACHMENT_SOURCE_BADGE_CLASSES,
  ATTACHMENT_SOURCE_FILTER_OPTIONS,
  deriveAttachmentType,
  deriveAttachmentCategory,
  formatAttachmentSize,
  computeAttachmentSourceCounts,
  ATTACHMENT_STATUS_LABEL,
} from './contract-attachment-helpers';
import type { ContractAttachment } from '@/lib/contracts-api';

function makeAttachment(overrides: Partial<ContractAttachment> = {}): ContractAttachment {
  return {
    id: 'a1',
    originalFileName: 'file.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    createdAt: '2026-01-05T00:00:00Z',
    uploadedByUser: null,
    source: 'WORKFLOW_TASK',
    sourceLabel: 'Workflow Task',
    relatedItemTitle: 'Some Task',
    documentObligationCategory: null,
    downloadPath: '/x',
    ...overrides,
  };
}

describe('ATTACHMENT_SOURCE_BADGE_CLASSES', () => {
  it('has a distinct class for every real source', () => {
    expect(ATTACHMENT_SOURCE_BADGE_CLASSES.WORKFLOW_TASK).toBeTruthy();
    expect(ATTACHMENT_SOURCE_BADGE_CLASSES.VARIATION).toBeTruthy();
    expect(ATTACHMENT_SOURCE_BADGE_CLASSES.DOCUMENT_OBLIGATION).toBeTruthy();
    expect(ATTACHMENT_SOURCE_BADGE_CLASSES.CLOSEOUT).toBeTruthy();
    const values = Object.values(ATTACHMENT_SOURCE_BADGE_CLASSES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('ATTACHMENT_SOURCE_FILTER_OPTIONS', () => {
  it('starts with "All Sources" plus the 4 real sources, no fake source', () => {
    expect(ATTACHMENT_SOURCE_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All Sources' });
    expect(ATTACHMENT_SOURCE_FILTER_OPTIONS).toHaveLength(5);
  });
});

describe('deriveAttachmentType', () => {
  it('maps a known MIME type to its manager-facing label', () => {
    expect(deriveAttachmentType('application/pdf', 'bond.pdf')).toBe('PDF');
    expect(deriveAttachmentType('image/png', 'photo.png')).toBe('PNG');
    expect(deriveAttachmentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'sheet.xlsx')).toBe('XLSX');
  });

  it('falls back to the file extension for an unrecognized MIME type', () => {
    expect(deriveAttachmentType('application/octet-stream', 'drawing.dwg')).toBe('DWG');
  });

  it('falls back to "FILE" when there is no extension at all (never a fabricated guess)', () => {
    expect(deriveAttachmentType('application/octet-stream', 'noextension')).toBe('FILE');
  });
});

describe('deriveAttachmentCategory', () => {
  it('uses the safe source-derived label for Workflow/Variation/Closeout, never a fabricated specific category', () => {
    expect(deriveAttachmentCategory(makeAttachment({ source: 'WORKFLOW_TASK' }))).toBe('Workflow Document');
    expect(deriveAttachmentCategory(makeAttachment({ source: 'VARIATION' }))).toBe('Variation Document');
    expect(deriveAttachmentCategory(makeAttachment({ source: 'CLOSEOUT' }))).toBe('Closeout Document');
  });

  it('uses the real Documents & Obligations category when the backend provided one', () => {
    const a = makeAttachment({ source: 'DOCUMENT_OBLIGATION', documentObligationCategory: 'PERFORMANCE_BOND' });
    expect(deriveAttachmentCategory(a)).toBe('Performance Bond');
  });

  it('falls back to the safe "Contract Document" label for a Documents & Obligations attachment with no category (never invents one)', () => {
    const a = makeAttachment({ source: 'DOCUMENT_OBLIGATION', documentObligationCategory: null });
    expect(deriveAttachmentCategory(a)).toBe('Contract Document');
  });
});

describe('ATTACHMENT_STATUS_LABEL', () => {
  it('is the single honest status, never Approved/Pending Review', () => {
    expect(ATTACHMENT_STATUS_LABEL).toBe('Uploaded');
  });
});

describe('computeAttachmentSourceCounts', () => {
  it('counts totalFiles as every attachment, regardless of source', () => {
    const counts = computeAttachmentSourceCounts([
      makeAttachment({ source: 'WORKFLOW_TASK' }),
      makeAttachment({ source: 'VARIATION' }),
    ]);
    expect(counts.totalFiles).toBe(2);
  });

  it('counts each real source independently', () => {
    const counts = computeAttachmentSourceCounts([
      makeAttachment({ source: 'WORKFLOW_TASK' }),
      makeAttachment({ source: 'WORKFLOW_TASK' }),
      makeAttachment({ source: 'VARIATION' }),
      makeAttachment({ source: 'DOCUMENT_OBLIGATION' }),
      makeAttachment({ source: 'CLOSEOUT' }),
    ]);
    expect(counts).toEqual({
      totalFiles: 5,
      workflowFiles: 2,
      variationFiles: 1,
      documentObligationFiles: 1,
      closeoutFiles: 1,
    });
  });

  it('returns all zeros for an empty attachment list (no files — never fake rows)', () => {
    expect(computeAttachmentSourceCounts([])).toEqual({
      totalFiles: 0,
      workflowFiles: 0,
      variationFiles: 0,
      documentObligationFiles: 0,
      closeoutFiles: 0,
    });
  });
});

describe('formatAttachmentSize', () => {
  it('formats bytes under 1KB as plain bytes', () => {
    expect(formatAttachmentSize(512)).toBe('512 B');
  });

  it('formats kilobytes with one decimal', () => {
    expect(formatAttachmentSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatAttachmentSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
