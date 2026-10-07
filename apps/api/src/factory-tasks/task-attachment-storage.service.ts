import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { createReadStream, type ReadStream } from 'node:fs';
import * as path from 'node:path';
import { getApiEnv } from '../env';

// ---------------------------------------------------------------------------
// FMP-TASK-05 - safe local-disk storage for Task Attachments. Same pattern as
// IncidentAttachmentStorageService (random UUID on-disk name per task
// subfolder, path-traversal guard, best-effort disk cleanup on delete).
//
// Only the MIME types below are accepted; anything else (including
// .exe/.bat/.cmd/.ps1/.sh/.js/.html/.svg) is rejected by construction.
// ---------------------------------------------------------------------------

export const TASK_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25MB per file

export const TASK_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv',
  'text/plain', // .txt
] as const;

@Injectable()
export class TaskAttachmentStorageService {
  private baseDir(): string {
    const configured = getApiEnv().taskAttachmentsDir;
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }

  /** Stores a buffer under a per-task subfolder with a random filename; the caller-supplied name is never used on disk. */
  async save(taskId: string, buffer: Buffer, originalFileName: string): Promise<{ fileName: string; storagePath: string }> {
    const ext = path.extname(originalFileName).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
    const fileName = `${randomUUID()}${ext}`;
    const relativePath = path.join(taskId, fileName);
    const absoluteDir = path.join(this.baseDir(), taskId);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), buffer);

    return { fileName, storagePath: relativePath };
  }

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

  /** Best-effort disk cleanup; never throws. */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      await unlink(this.resolveAbsolutePath(storagePath));
    } catch {
      // Deliberately swallowed.
    }
  }
}
