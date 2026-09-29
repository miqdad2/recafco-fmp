import { describe, it, expect } from 'vitest';
import {
  validateEvidenceFile,
  formatEvidenceFileSize,
  friendlyEvidenceFileType,
  INCIDENT_ATTACHMENT_MAX_BYTES,
} from './evidence-validation';

describe('validateEvidenceFile', () => {
  it('accepts every allowed MIME type under the size limit', () => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf', 'text/csv', 'text/plain'];
    for (const type of allowed) {
      expect(validateEvidenceFile({ type, size: 1024 })).toBeNull();
    }
  });

  it('rejects an unsupported file type', () => {
    expect(validateEvidenceFile({ type: 'application/x-msdownload', size: 1024 })).toBe('File type is not supported.');
    expect(validateEvidenceFile({ type: 'text/html', size: 1024 })).toBe('File type is not supported.');
  });

  it('rejects a file over 25MB with the exact required message', () => {
    const result = validateEvidenceFile({ type: 'image/jpeg', size: INCIDENT_ATTACHMENT_MAX_BYTES + 1 });
    expect(result).toBe('File is too large. Maximum size is 25MB.');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateEvidenceFile({ type: 'image/jpeg', size: INCIDENT_ATTACHMENT_MAX_BYTES })).toBeNull();
  });
});

describe('formatEvidenceFileSize', () => {
  it('formats bytes, KB, and MB appropriately', () => {
    expect(formatEvidenceFileSize(500)).toBe('500 B');
    expect(formatEvidenceFileSize(2048)).toBe('2.0 KB');
    expect(formatEvidenceFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('friendlyEvidenceFileType', () => {
  it('maps known MIME types to readable labels', () => {
    expect(friendlyEvidenceFileType('image/jpeg')).toBe('Image');
    expect(friendlyEvidenceFileType('video/mp4')).toBe('Video');
    expect(friendlyEvidenceFileType('application/pdf')).toBe('PDF');
    expect(friendlyEvidenceFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Word document');
    expect(friendlyEvidenceFileType('application/vnd.ms-excel')).toBe('Excel document');
    expect(friendlyEvidenceFileType('text/csv')).toBe('CSV');
    expect(friendlyEvidenceFileType('text/plain')).toBe('Text file');
  });

  it('falls back to the raw MIME type for anything unmapped', () => {
    expect(friendlyEvidenceFileType('application/zip')).toBe('application/zip');
  });
});
