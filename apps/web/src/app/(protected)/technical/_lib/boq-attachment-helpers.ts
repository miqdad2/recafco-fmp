import type { BoqItemAttachment } from '@/lib/technical-api';

// ---------------------------------------------------------------------------
// FMP-BOQ-17 — pure helpers for BOQ item drawing files. The API stays the
// authority on file type and size; these checks only give a friendly message
// before an upload is attempted (and before Register Contract is submitted).
// ---------------------------------------------------------------------------

export const BOQ_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const BOQ_FILE_MAX_MB = BOQ_FILE_MAX_BYTES / (1024 * 1024);

/** Same set the Technical drawing upload accepts (TIF/TIFF included). */
export const BOQ_FILE_EXTENSIONS = ['pdf', 'tif', 'tiff', 'dwg', 'dxf', 'jpg', 'jpeg', 'png', 'webp', 'xls', 'xlsx', 'doc', 'docx'] as const;

export const BOQ_FILE_ACCEPT = BOQ_FILE_EXTENSIONS.map((e) => `.${e}`).join(',');
/** FMP-TECH-28 — the one helper text and one refusal message every Technical drawing upload shows (BOQ, group, individual element). */
export const BOQ_FILE_TYPES_TEXT = 'Accepted files: PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word, or Excel. Maximum 25 MB each.';
export const TECHNICAL_FILE_BAD_TYPE_MESSAGE = 'This file type is not allowed. Please upload PDF, TIF/TIFF, DWG, DXF, JPG, PNG, Word, or Excel.';

export const BOQ_FILE_TEXT = {
  attach: 'Attach Drawing / File',
  add: 'Add Drawing / File',
  addMore: 'Add more files',
  noFiles: 'No files attached',
  reference: 'Drawing files are for reference. Element quantity will be confirmed by Technical.',
  needItemRow: 'Fill in the item description before attaching a file to it.',
  uploadFailed: 'File could not be uploaded. Please try again.',
} as const;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** The file name carries one of the accepted Technical drawing extensions. */
export function hasAllowedDrawingExtension(fileName: string): boolean {
  return (BOQ_FILE_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
}

/** Friendly message when a file cannot be used, otherwise null. */
export function validateBoqFile(file: { name: string; size: number }): string | null {
  if (!(BOQ_FILE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return `${file.name}: ${TECHNICAL_FILE_BAD_TYPE_MESSAGE}`;
  }
  if (file.size > BOQ_FILE_MAX_BYTES) {
    return `${file.name}: this file is too large. The limit is ${BOQ_FILE_MAX_MB} MB per file.`;
  }
  if (file.size === 0) {
    return `${file.name}: this file is empty.`;
  }
  return null;
}

/** Splits a picked list into usable files and friendly errors for the rest. */
export function splitValidBoqFiles<T extends { name: string; size: number }>(files: T[]): { valid: T[]; errors: string[] } {
  const valid: T[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const message = validateBoqFile(file);
    if (message) errors.push(message);
    else valid.push(file);
  }
  return { valid, errors };
}

/** "1 file attached" / "3 files attached" / "No files attached". */
export function filesAttachedText(count: number): string {
  if (count <= 0) return BOQ_FILE_TEXT.noFiles;
  return `${count} ${count === 1 ? 'file' : 'files'} attached`;
}

/** "1 — Item description" style label used in item pickers and file lists. */
export function boqItemLabel(item: { sortOrder: number; itemCode?: string | null; description: string }): string {
  const code = item.itemCode ? `${item.itemCode} · ` : '';
  const text = item.description.length > 60 ? `${item.description.slice(0, 57)}…` : item.description;
  return `${item.sortOrder}. ${code}${text}`;
}

export function groupAttachmentsByItem(attachments: BoqItemAttachment[]): Map<string, BoqItemAttachment[]> {
  const map = new Map<string, BoqItemAttachment[]>();
  for (const a of attachments) {
    const list = map.get(a.boqItemId);
    if (list) list.push(a);
    else map.set(a.boqItemId, [a]);
  }
  return map;
}

export function boqAttachmentSourceLabel(sourceType: BoqItemAttachment['sourceType']): string {
  return sourceType === 'TECHNICAL_REFERENCE' ? 'Technical reference' : 'Client drawing';
}

/** Same-origin file routes (proxy the API; department access is re-checked there). */
export function boqAttachmentViewHref(contractId: string, attachmentId: string): string {
  return `/technical/jobs/${contractId}/boq-attachments/${attachmentId}/open`;
}

/** FMP-TECH-20 — PNG preview of a TIFF, for the viewer only. Download keeps serving the original. */
export function boqAttachmentPreviewHref(contractId: string, attachmentId: string): string {
  return `/technical/jobs/${contractId}/boq-attachments/${attachmentId}/preview`;
}

export function boqAttachmentDownloadHref(contractId: string, attachmentId: string): string {
  return `/technical/jobs/${contractId}/boq-attachments/${attachmentId}/download`;
}

/**
 * New Contract Register — a staged file belongs to the register row it was attached
 * on. Rows with no values are dropped on save, so a file on such a row would have no
 * BOQ item to belong to. Returns the 0-based position of each staged file's item among
 * the rows that WILL be saved, or an error message.
 */
export function mapStagedFilesToSavedItems(
  stagedRowIds: string[],
  savedRowIds: string[],
): { positions: number[]; error: null } | { positions: null; error: string } {
  const positions: number[] = [];
  for (const rowId of stagedRowIds) {
    const position = savedRowIds.indexOf(rowId);
    if (position < 0) return { positions: null, error: BOQ_FILE_TEXT.needItemRow };
    positions.push(position);
  }
  return { positions, error: null };
}

/**
 * Files chosen on New Contract Register travel to the server together with the
 * contract (the server accepts about 30 MB per save). Stay under that with a
 * plain message instead of a failed save; extra files can be added afterwards.
 */
export const BOQ_REGISTER_TOTAL_MAX_BYTES = 28 * 1024 * 1024;

export const REGISTER_TOO_MANY_FILES_TEXT =
  'Too many files selected for contract registration. Please register the contract first, then add the files from BOQ Progress.';

export function registerFilesTotalError(files: { size: number }[]): string | null {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  return total <= BOQ_REGISTER_TOTAL_MAX_BYTES ? null : REGISTER_TOO_MANY_FILES_TEXT;
}

// ---------------------------------------------------------------------------
// FMP-TECH-19 — what the in-page drawing viewer can show for a file.
// ---------------------------------------------------------------------------

export type BoqPreviewKind = 'image' | 'pdf' | 'tiff' | 'unsupported';

/** Browsers show PNG/JPG/WebP and PDF directly; TIFF is shown through a server-made PNG preview; DWG, DXF and Office files cannot be previewed, so the viewer offers Download instead. */
export function boqPreviewKind(fileName: string, mimeType: string): BoqPreviewKind {
  const ext = extensionOf(fileName);
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime === 'image/tiff' || ext === 'tif' || ext === 'tiff') return 'tiff';
  if (['image/png', 'image/jpeg', 'image/webp'].includes(mime) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  return 'unsupported';
}

export const BOQ_VIEWER_ZOOM = { min: 0.05, max: 8, step: 1.25 } as const;

/** Next zoom level for the Zoom In / Zoom Out buttons, kept inside the allowed range. */
export function stepBoqZoom(current: number, direction: 'in' | 'out'): number {
  const next = direction === 'in' ? current * BOQ_VIEWER_ZOOM.step : current / BOQ_VIEWER_ZOOM.step;
  return Math.min(BOQ_VIEWER_ZOOM.max, Math.max(BOQ_VIEWER_ZOOM.min, next));
}

/** Rotation in 90° steps, always 0/90/180/270. */
export function rotateBoq(current: number, direction: 'left' | 'right'): number {
  return (((current + (direction === 'right' ? 90 : -90)) % 360) + 360) % 360;
}

/** FMP-TECH-27 — same-origin routes for an element's own final drawing files. */
export function elementDrawingViewHref(contractId: string, pieceId: string, attachmentId: string): string {
  return `/technical/jobs/${contractId}/element-drawings/${pieceId}/files/${attachmentId}/open`;
}

export function elementDrawingDownloadHref(contractId: string, pieceId: string, attachmentId: string): string {
  return `/technical/jobs/${contractId}/element-drawings/${pieceId}/files/${attachmentId}/download`;
}
