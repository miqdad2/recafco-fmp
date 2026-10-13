import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile, rename, access } from 'node:fs/promises';
import { createReadStream, type ReadStream } from 'node:fs';
import * as path from 'node:path';
import { getApiEnv } from '../env';

// ---------------------------------------------------------------------------
// FMP-TECH-01 — safe local-disk storage for Technical Drawing attachments.
// Structure mirrors IncidentAttachmentStorageService exactly (random UUID
// on-disk filename per parent-entity subfolder, path-traversal guard,
// best-effort disk cleanup on delete) — the same reused pattern, not a new
// storage style. No MinIO/S3 (this codebase has neither configured
// anywhere — confirmed by FMP-UI-22's own audit, reconfirmed here).
//
// MIME/size policy: drawings are documents/images, not video — narrower
// than the Incident Evidence set (which deliberately includes video).
// ---------------------------------------------------------------------------

export const TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25MB

export const TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/dwg',
  'image/vnd.dwg',
  'application/acad',
  'application/x-dwg', // .dwg (no single registered MIME type; browsers report any of these depending on OS/config)
  'application/dxf',
  'image/vnd.dxf', // .dxf
  'image/tiff', // .tif/.tiff (FMP-TECH-05 — scanned drawings)
  'image/tif',
  'application/tiff',
  'application/x-tiff',
] as const;

/** FMP-TECH-28 — one message for every Technical drawing upload that refuses a file type. */
export const TECHNICAL_FILE_BAD_TYPE_MESSAGE = 'This file type is not allowed. Please upload PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word, or Excel.';

/** Browsers and Windows often report DWG/DXF as a generic type (or none at all), so the extension decides. */
const GENERIC_MIME_TYPES: readonly string[] = ['', 'application/octet-stream'];
const CAD_MIME_BY_EXTENSION: Record<string, string> = { '.dwg': 'application/acad', '.dxf': 'application/dxf' };

const ALLOWED_EXTENSIONS: readonly string[] = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.dwg', '.dxf'];
const TIFF_EXTENSION =/\.tiff?$/i;
const TIFF_MIME_TYPES: readonly string[] = ['image/tiff', 'image/tif', 'application/tiff', 'application/x-tiff'];

/**
 * FMP-TECH-05 — Windows/browsers report TIFF uploads under varying (or empty /
 * application/octet-stream) MIME types, so a .tif/.tiff extension is also
 * accepted. Returns the MIME type to validate/store (TIFF is normalised to
 * image/tiff), or null when the file is not allowed.
 */
export function resolveTechnicalAttachmentMimeType(file: { originalname: string; mimetype: string }): string | null {
  const mime = (file.mimetype ?? '').toLowerCase();
  const cadMime = CAD_MIME_BY_EXTENSION[path.extname(file.originalname ?? '').toLowerCase()];
  if (cadMime && GENERIC_MIME_TYPES.includes(mime)) return cadMime;
  if (TIFF_EXTENSION.test(file.originalname ?? '')) {
    if (TIFF_MIME_TYPES.includes(mime) || mime === '' || mime === 'application/octet-stream') return 'image/tiff';
    return null;
  }
  // The file name must carry an allowed extension as well as an allowed type.
  if (!ALLOWED_EXTENSIONS.includes(path.extname(file.originalname ?? '').toLowerCase())) return null;
  return (TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype) ? file.mimetype : null;
}

@Injectable()
export class TechnicalAttachmentStorageService {
  private baseDir(): string {
    const configured = getApiEnv().technicalDrawingAttachmentsDir;
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }

  /**
   * Stores a buffer under a per-drawing subfolder using a random,
   * collision-free filename — the caller-supplied original filename is
   * never used as the on-disk name (only recorded in the DB for display/
   * download), which eliminates path-traversal and overwrite risk entirely.
   */
  async save(technicalDrawingId: string, buffer: Buffer, originalFileName: string): Promise<{ fileName: string; storagePath: string }> {
    const ext = path.extname(originalFileName).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
    const fileName = `${randomUUID()}${ext}`;
    const relativePath = path.join(technicalDrawingId, fileName);
    const absoluteDir = path.join(this.baseDir(), technicalDrawingId);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), buffer);

    return { fileName, storagePath: relativePath };
  }

  /**
   * Resolves a DB-stored relative path to an absolute filesystem path,
   * confined to the base upload directory — defense-in-depth even though
   * storagePath values are always generated by save(), never user input.
   */
  private resolveAbsolutePath(storagePath: string): string {
    const base = path.normalize(this.baseDir());
    const resolved = path.normalize(path.join(base, storagePath));
    if (!resolved.startsWith(base)) {
      throw new Error('Resolved attachment path escapes the storage root');
    }
    return resolved;
  }

  createReadStream(storagePath: string): ReadStream {
    return createReadStream(this.resolveAbsolutePath(storagePath));
  }

  async readBuffer(storagePath: string): Promise<Buffer> {
    return readFile(this.resolveAbsolutePath(storagePath));
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await access(this.resolveAbsolutePath(storagePath));
      return true;
    } catch {
      return false;
    }
  }

  /** Writes a derived file (e.g. a preview) at a known key, via a temp file + rename so a reader never sees half a file. */
  async writeDerived(storagePath: string, buffer: Buffer): Promise<void> {
    const target = this.resolveAbsolutePath(storagePath);
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, buffer);
    await rename(temp, target);
  }

  /** Best-effort disk cleanup — deliberately never throws, matching every existing deleteFile()'s own rule: a missing/already-removed file must never fail the delete request. */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      await unlink(this.resolveAbsolutePath(storagePath));
    } catch {
      // Deliberately swallowed.
    }
  }
}
