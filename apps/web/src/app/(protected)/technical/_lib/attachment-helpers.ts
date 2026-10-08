import type { TechnicalAttachment } from '@/lib/technical-api';

/** FMP-TECH-05 — accepted-file hint shown beside the Technical drawing/SD upload controls. */
export const TECHNICAL_ACCEPTED_FILE_TYPES_TEXT = 'Accepted: PDF, DOC/DOCX, XLS/XLSX, DWG/DXF, TIF/TIFF, JPG/PNG/WEBP';

/** FMP-TECH-05 — TIFF scans get a View action (the viewer page falls back to download guidance). */
export function isTiffAttachment(a: Pick<TechnicalAttachment, 'originalFileName' | 'mimeType'>): boolean {
  return /\.tiff?$/i.test(a.originalFileName) || a.mimeType.toLowerCase().includes('tif');
}

/** FMP-TECH-06 — same-origin file-serving route (proxies the API's inline `.../view` endpoint); never a frontend page. */
export function drawingAttachmentViewHref(contractId: string, attachmentId: string): string {
  return `/technical/jobs/${contractId}/workflow/drawing-received/attachments/${attachmentId}/open`;
}

export const TIFF_PREVIEW_HELPER_TEXT = 'TIFF preview may not be supported in all browsers. Use Download if it does not open.';

/** FMP-TECH-06 — the only fields required to complete Drawing Received, in display order. */
export const DRAWING_RECEIVED_REQUIRED_FIELDS = [
  { key: 'receivedDate', label: 'Received Date' },
  { key: 'receivedFrom', label: 'Received From' },
  { key: 'drawingType', label: 'Drawing Type' },
  { key: 'drawingReferenceNo', label: 'Drawing Reference No' },
  { key: 'revisionNo', label: 'Revision No' },
  { key: 'numberOfSheets', label: 'Number of Sheets' },
] as const;

/** Maps backend field keys to readable labels (unknown keys are dropped, never shown raw). */
export function friendlyMissingLabels(keys: readonly string[]): string[] {
  return DRAWING_RECEIVED_REQUIRED_FIELDS.filter((f) => keys.includes(f.key)).map((f) => f.label);
}

/** True when all 6 required fields have a value on the saved drawing. */
export function isDrawingReceivedReady(drawing: Record<string, unknown> | null | undefined): boolean {
  if (!drawing) return false;
  return DRAWING_RECEIVED_REQUIRED_FIELDS.every((f) => {
    const v = drawing[f.key];
    return v !== null && v !== undefined && v !== '';
  });
}
