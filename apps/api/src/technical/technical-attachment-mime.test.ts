import { describe, it, expect } from 'vitest';
import { resolveTechnicalAttachmentMimeType } from './technical-attachment-storage.service';

const r = (originalname: string, mimetype: string): string | null => resolveTechnicalAttachmentMimeType({ originalname, mimetype });

describe('resolveTechnicalAttachmentMimeType (FMP-TECH-05)', () => {
  it('accepts .tif and .tiff with TIFF MIME types and normalises to image/tiff', () => {
    expect(r('scan.tif', 'image/tiff')).toBe('image/tiff');
    expect(r('scan.TIFF', 'image/tif')).toBe('image/tiff');
    expect(r('scan.tiff', 'application/x-tiff')).toBe('image/tiff');
    expect(r('scan.tif', 'application/tiff')).toBe('image/tiff');
  });

  it('accepts a TIFF extension with a generic/empty browser MIME type', () => {
    expect(r('scan.tif', 'application/octet-stream')).toBe('image/tiff');
    expect(r('scan.tiff', '')).toBe('image/tiff');
  });

  it('rejects a TIFF extension carrying an unrelated MIME type', () => {
    expect(r('scan.tif', 'application/x-msdownload')).toBeNull();
  });

  it('rejects unsupported extensions, including a TIFF MIME type on a non-TIFF name', () => {
    expect(r('x.exe', 'application/x-msdownload')).toBeNull();
    expect(r('x.exe', 'application/octet-stream')).toBeNull();
  });

  it('keeps existing types working unchanged', () => {
    expect(r('a.pdf', 'application/pdf')).toBe('application/pdf');
    expect(r('a.jpg', 'image/jpeg')).toBe('image/jpeg');
    expect(r('a.dwg', 'application/acad')).toBe('application/acad');
  });
});
