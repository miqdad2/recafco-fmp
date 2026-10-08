import { TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { UnprocessableEntityException } from '@nestjs/common';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// FMP-BOQ-12 — rules for files attached to a Drawing / Calculation Group.
// ---------------------------------------------------------------------------

export const GROUP_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** extension → the MIME types a browser may report for it. Both must match. */
export const GROUP_FILE_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
};

export const GROUP_FILE_CATEGORIES = ['DRAWING', 'CALCULATION', 'APPROVAL_DOCUMENT', 'OTHER'] as const;
export type GroupFileCategory = (typeof GROUP_FILE_CATEGORIES)[number];

export const GROUP_FILE_MESSAGES = {
  noFile: 'Please select a file.',
  noCategory: 'Please select file category.',
  tooLarge: 'File is too large.',
  badType: 'This file type is not allowed.',
  releasedChange: 'Released groups cannot be changed.',
  releasedRemove: 'Released groups cannot have files removed.',
  groupClosed: 'This group cannot be changed.',
  notFound: 'File not found.',
  groupNotFound: 'Drawing group not found.',
} as const;

function reject(code: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}

/** Checks the file itself (present, small enough, allowed extension AND matching MIME type). */
export function validateGroupFile(file: { originalname: string; mimetype: string; size: number } | undefined): void {
  if (!file) throw reject('GROUP_FILE_REQUIRED', GROUP_FILE_MESSAGES.noFile);
  if (file.size > GROUP_FILE_MAX_BYTES) throw reject('GROUP_FILE_TOO_LARGE', GROUP_FILE_MESSAGES.tooLarge);
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMime = GROUP_FILE_TYPES[ext];
  if (!allowedMime || !allowedMime.includes(file.mimetype)) throw reject('GROUP_FILE_BAD_TYPE', GROUP_FILE_MESSAGES.badType);
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
