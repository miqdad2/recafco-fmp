import { BOQ_FILE_ACCEPT, TECHNICAL_FILE_BAD_TYPE_MESSAGE, hasAllowedDrawingExtension } from './boq-attachment-helpers';
import type { BoqPiece, DrawingGroupFileCategory, DrawingGroupStatus, GroupablePiece } from '@/lib/technical-api';

// FMP-BOQ-11 — wording, validation and piece-picker helpers for Technical
// Drawing / Calculation Groups.

export const DRAWING_GROUP_STATUS_LABELS: Record<DrawingGroupStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  RELEASED_TO_PRODUCTION: 'Released to Production',
  REVISED: 'Revised',
  CANCELLED: 'Cancelled',
};

export const DRAWING_GROUP_STATUS_CLASSES: Record<DrawingGroupStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-secondary',
  SUBMITTED: 'bg-info-light text-info',
  APPROVED: 'bg-success-light text-success',
  RELEASED_TO_PRODUCTION: 'bg-success-light text-success',
  REVISED: 'bg-warning-light text-warning',
  CANCELLED: 'bg-surface-secondary text-text-muted line-through',
};

export interface GroupFormValues {
  boqItemId: string;
  drawingNo: string;
  selectedCount: number;
}

export type GroupFormErrors = Partial<Record<'boqItemId' | 'drawingNo' | 'pieces', string>>;

/** Plain-language checks. Elements are only mandatory when submitting; a draft may be saved without them. */
export function validateGroupForm(values: GroupFormValues, submitting: boolean): GroupFormErrors {
  const errors: GroupFormErrors = {};
  if (!values.boqItemId.trim()) errors.boqItemId = 'Please select BOQ item.';
  if (!values.drawingNo.trim()) errors.drawingNo = 'Please enter drawing number.';
  if (submitting && values.selectedCount === 0) errors.pieces = 'Please select at least one element.';
  return errors;
}

/** The group a piece sits in, for lists: "HC-001 · CALC-001", or "Not assigned". */
export function pieceGroupLabel(piece: Pick<BoqPiece, 'drawingGroupLinks'> | Pick<GroupablePiece, 'drawingGroupLinks'>): string {
  const group = piece.drawingGroupLinks?.[0]?.group;
  if (!group) return 'Not Assigned to Group';
  return [group.drawingNo, group.calculationRef].filter(Boolean).join(' · ');
}

/** Elements whose code contains the search text (case-insensitive); empty search keeps all. */
export function filterPiecesByCode<T extends { pieceCode: string }>(pieces: T[], search: string): T[] {
  const q = search.trim().toLowerCase();
  return q ? pieces.filter((p) => p.pieceCode.toLowerCase().includes(q)) : pieces;
}

/**
 * Elements that can be ticked for this group: not in another active group. Elements already in
 * THIS group (when editing) stay selectable.
 */
export function isPieceSelectable(piece: GroupablePiece, editingGroupId: string | null): boolean {
  // FMP-TECH-27 — an element with its own final drawing, or released on its own, stays individual.
  if (hasOwnDrawing(piece)) return false;
  const current = piece.drawingGroupLinks[0]?.group;
  return !current || current.id === editingGroupId;
}

/** The element has its own final drawing files, or was released on its own. */
export function hasOwnDrawing(piece: Pick<GroupablePiece, 'releasedToProductionAt' | '_count'>): boolean {
  return Boolean(piece.releasedToProductionAt) || (piece._count?.attachments ?? 0) > 0;
}

/**
 * FMP-TECH-24 — elements numbered from..to (either order) that can be ticked for this group, for "Select range 1–10".
 * Elements already in another active group are skipped.
 */
export function selectableIdsInRange(pieces: GroupablePiece[], from: number, to: number, editingGroupId: string | null): string[] {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  return pieces.filter((p) => p.pieceNo >= low && p.pieceNo <= high && isPieceSelectable(p, editingGroupId)).map((p) => p.id);
}

/** Toggles every selectable visible piece on or off ("Select all visible"). */
export function toggleVisible(selected: Set<string>, visibleSelectable: { id: string }[]): Set<string> {
  const allOn = visibleSelectable.length > 0 && visibleSelectable.every((p) => selected.has(p.id));
  const next = new Set(selected);
  for (const p of visibleSelectable) {
    if (allOn) next.delete(p.id);
    else next.add(p.id);
  }
  return next;
}

export const GROUP_ACTION_LABELS = {
  EDIT: 'Edit',
  SUBMIT: 'Submit',
  APPROVE: 'Approve',
  RELEASE: 'Release to Production',
  CANCEL: 'Cancel',
} as const;

export function formatGroupDate(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
}

// ---------------------------------------------------------------------------
// FMP-BOQ-12 — files on a group
// ---------------------------------------------------------------------------

export const GROUP_FILE_CATEGORY_LABELS: Record<DrawingGroupFileCategory, string> = {
  DRAWING: 'Drawing',
  CALCULATION: 'Calculation',
  APPROVAL_DOCUMENT: 'Approval Document',
  OTHER: 'Other',
};

// FMP-TECH-28 — new uploads choose Drawing (default), Calculation or Other. Older files may still carry Approval Document, which keeps its label above.
export const GROUP_FILE_CATEGORY_OPTIONS = (['DRAWING', 'CALCULATION', 'OTHER'] as DrawingGroupFileCategory[]).map((value) => ({
  value,
  label: GROUP_FILE_CATEGORY_LABELS[value],
}));

export const GROUP_FILE_DEFAULT_CATEGORY: DrawingGroupFileCategory = 'DRAWING';

export const GROUP_FILE_MAX_BYTES = 25 * 1024 * 1024;
// Same accepted drawing types as every other Technical upload (PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word, Excel).
export const GROUP_FILE_ACCEPT = BOQ_FILE_ACCEPT;

/** Plain-language checks done in the browser before upload (the server checks again). Returns a message or null. */
export function validateGroupUpload(file: { name: string; size: number } | null, category: string): string | null {
  if (!file) return 'Please select a file.';
  if (!category) return 'Please select file category.';
  if (!hasAllowedDrawingExtension(file.name)) return TECHNICAL_FILE_BAD_TYPE_MESSAGE;
  if (file.size > GROUP_FILE_MAX_BYTES) return 'File is too large.';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Files can be added or removed only until the group is released (Draft, Submitted, Approved). */
export function canChangeGroupFiles(status: DrawingGroupStatus): boolean {
  return status === 'DRAFT' || status === 'SUBMITTED' || status === 'APPROVED';
}

/** Why files cannot be changed, in plain words (null = they can). */
export function groupFilesLockedMessage(status: DrawingGroupStatus): string | null {
  if (canChangeGroupFiles(status)) return null;
  return status === 'RELEASED_TO_PRODUCTION' ? 'Released groups cannot be changed.' : 'This group cannot be changed.';
}

/** "No files attached." / "1 file" / "3 files" */
export function fileCountLabel(count: number): string {
  if (count === 0) return 'No files attached.';
  return count === 1 ? '1 file' : `${count} files`;
}

/** The file count of the group a piece sits in (0 when the element is not assigned). */
export function pieceGroupFileCount(piece: Pick<BoqPiece, 'drawingGroupLinks'>): number {
  return piece.drawingGroupLinks?.[0]?.group._count?.attachments ?? 0;
}
