import { TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { UnprocessableEntityException } from '@nestjs/common';
import { TECHNICAL_FILE_BAD_TYPE_MESSAGE, resolveTechnicalAttachmentMimeType } from './technical-attachment-storage.service';

// ---------------------------------------------------------------------------
// FMP-BOQ-12 — rules for files attached to a Drawing / Calculation Group.
// ---------------------------------------------------------------------------

export const GROUP_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export const GROUP_FILE_CATEGORIES = ['DRAWING', 'CALCULATION', 'APPROVAL_DOCUMENT', 'OTHER'] as const;
export type GroupFileCategory = (typeof GROUP_FILE_CATEGORIES)[number];

export const GROUP_FILE_MESSAGES = {
  noFile: 'Please select a file.',
  noCategory: 'Please select file category.',
  tooLarge: 'File is too large.',
  // FMP-TECH-28 — group files accept the same drawing file types as every other Technical drawing upload.
  badType: TECHNICAL_FILE_BAD_TYPE_MESSAGE,
  releasedChange: 'Released groups cannot be changed.',
  releasedRemove: 'Released groups cannot have files removed.',
  groupClosed: 'This group cannot be changed.',
  notFound: 'File not found.',
  groupNotFound: 'Drawing group not found.',
} as const;

function reject(code: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}

/**
 * Checks the file itself (present, small enough, an allowed Technical drawing type) and returns the MIME type to
 * store. The allowed types are the shared Technical list: PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word, Excel.
 */
export function validateGroupFile(file: { originalname: string; mimetype: string; size: number } | undefined): string {
  if (!file) throw reject('GROUP_FILE_REQUIRED', GROUP_FILE_MESSAGES.noFile);
  if (file.size > GROUP_FILE_MAX_BYTES) throw reject('GROUP_FILE_TOO_LARGE', GROUP_FILE_MESSAGES.tooLarge);
  const mimeType = resolveTechnicalAttachmentMimeType(file);
  if (mimeType === null) throw reject('GROUP_FILE_BAD_TYPE', GROUP_FILE_MESSAGES.badType);
  return mimeType;
}

/** Files can be added and removed while the group is Draft, Submitted or Approved only. */
export function groupAcceptsFileChanges(status: S): boolean {
  return status === S.DRAFT || status === S.SUBMITTED || status === S.APPROVED;
}

/** The plain message for why a group's files cannot be changed (null = they can). */
export function groupFileChangeBlockedMessage(status: S, action: 'upload' | 'remove'): string | null {
  if (groupAcceptsFileChanges(status)) return null;
  if (status === S.RELEASED_TO_PRODUCTION) return action === 'upload' ? GROUP_FILE_MESSAGES.releasedChange : GROUP_FILE_MESSAGES.releasedRemove;
  return GROUP_FILE_MESSAGES.groupClosed;
}
