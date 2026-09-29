/**
 * FMP-INC-01C — shared evidence-file rules for BOTH the Report Incident
 * create page's new staging UI and the Incident Detail page's existing
 * `IncidentEvidenceAttachments` upload area (FMP-INC-01). Single source
 * of truth so the two places can never drift into showing 2 different
 * messages for the same rule — must match
 * `INCIDENT_ATTACHMENT_ALLOWED_MIME_TYPES` / `INCIDENT_ATTACHMENT_MAX_BYTES`
 * in `apps/api/src/incidents/incident-attachment-storage.service.ts`
 * exactly; the server independently enforces the same rule and remains
 * the actual source of truth — this is a real UX convenience (fail fast,
 * before a network round-trip), never the only check.
 */
export const INCIDENT_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

export const INCIDENT_ATTACHMENT_ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';

export const INCIDENT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_MB = INCIDENT_ATTACHMENT_MAX_BYTES / (1024 * 1024);

/** Exact wording per this unit's own brief — "File type is not supported." / "File is too large. Maximum size is 25MB." */
export function validateEvidenceFile(file: { type: string; size: number }): string | null {
  if (!INCIDENT_ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.type)) return 'File type is not supported.';
  if (file.size > INCIDENT_ATTACHMENT_MAX_BYTES) return `File is too large. Maximum size is ${MAX_MB}MB.`;
  return null;
}

export function formatEvidenceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface StagedEvidenceFile {
  file: File;
  error: string | null;
}

/** Validates each newly-selected file and appends it to the existing staged list — used identically by the create-page staging UI and the detail-page upload area. */
export function stageEvidenceFiles(fileList: FileList | null, existing: StagedEvidenceFile[]): StagedEvidenceFile[] {
  if (!fileList || fileList.length === 0) return existing;
  const next: StagedEvidenceFile[] = Array.from(fileList).map((file) => ({ file, error: validateEvidenceFile(file) }));
  return [...existing, ...next];
}

export function friendlyEvidenceFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('word')) return 'Word document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel document';
  if (mimeType === 'text/csv') return 'CSV';
  if (mimeType === 'text/plain') return 'Text file';
  return mimeType;
}
