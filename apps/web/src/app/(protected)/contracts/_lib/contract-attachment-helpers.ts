// ---------------------------------------------------------------------------
// CM-64 — Pure, presentation-agnostic helpers for the Contract Detail
// Attachments / Document Library tab. This tab has no upload path or
// approval workflow of its own — it only displays real files already
// uploaded through Workflow, Variations, Documents & Obligations, or
// Closeout (see contract-attachments.service.ts). No status/approval
// concept lives here; this file contains no such logic.
// Dependency-free so it can be unit tested directly, matching
// contract-risk-helpers.ts / contract-document-obligation-helpers.ts.
// ---------------------------------------------------------------------------

import type { ContractAttachment, ContractAttachmentSource, ContractDocumentObligationCategory } from '@/lib/contracts-api';
import { DOCUMENT_OBLIGATION_CATEGORY_LABELS } from './contract-document-obligation-helpers';

// CM-64C — `accent` in this theme's tokens is RECAFCO's brand red
// (#c62828, ui-tokens.md: "RECAFCO red is for branding and primary
// actions") — visually indistinguishable from an error/danger state, not a
// neutral "purple" as earlier unit comments in this codebase assumed.
// VARIATION previously used it here, which made a routine Variation file
// badge read as an alert. Switched to `team-production` (a real indigo
// token, #4f46e5) — soft, clean, and clearly non-alarming, distinct from
// the other 3 sources' colors. Workflow blue, Variations indigo, Documents
// & Obligations teal, Closeout green.
export const ATTACHMENT_SOURCE_BADGE_CLASSES: Record<ContractAttachmentSource, string> = {
  WORKFLOW_TASK: 'bg-info-light text-info',
  VARIATION: 'bg-team-production-light text-team-production',
  DOCUMENT_OBLIGATION: 'bg-teal-light text-teal',
  CLOSEOUT: 'bg-success-light text-success',
};

export interface AttachmentSourceFilterOption {
  value: ContractAttachmentSource | '';
  label: string;
}

export const ATTACHMENT_SOURCE_FILTER_OPTIONS: AttachmentSourceFilterOption[] = [
  { value: '', label: 'All Sources' },
  { value: 'WORKFLOW_TASK', label: 'Workflow & Team Tasks' },
  { value: 'VARIATION', label: 'Variations / Change Orders' },
  { value: 'DOCUMENT_OBLIGATION', label: 'Documents & Obligations' },
  { value: 'CLOSEOUT', label: 'Closeout' },
];

const MIME_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

/**
 * Manager-friendly file type label, derived from the real MIME type first
 * (never fabricated), falling back to the file's own extension when the
 * MIME type isn't one of the known allowed types — never a guessed/invented
 * type when neither is available.
 */
export function deriveAttachmentType(mimeType: string, originalFileName: string): string {
  const knownLabel = MIME_TYPE_LABELS[mimeType.toLowerCase()];
  if (knownLabel) return knownLabel;

  const dotIndex = originalFileName.lastIndexOf('.');
  if (dotIndex > -1 && dotIndex < originalFileName.length - 1) {
    return originalFileName.slice(dotIndex + 1).toUpperCase();
  }
  return 'FILE';
}

/** "0 B"/"12.3 KB"/"4.1 MB" — never a fabricated size. */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Safe, source-derived Category label used when a source has no more
 * specific real category of its own (Workflow/Variation/Closeout
 * attachments have no category field anywhere in this app). Documents &
 * Obligations attachments use their own real category instead — see
 * deriveAttachmentCategory() below.
 */
const SAFE_CATEGORY_LABEL_BY_SOURCE: Record<ContractAttachmentSource, string> = {
  WORKFLOW_TASK: 'Workflow Document',
  VARIATION: 'Variation Document',
  DOCUMENT_OBLIGATION: 'Contract Document',
  CLOSEOUT: 'Closeout Document',
};

/**
 * Category shown in the table's Category column. For a Documents &
 * Obligations attachment, uses that item's real, already-established
 * category label (Performance Bond, Insurance, etc. — see
 * DOCUMENT_OBLIGATION_CATEGORY_LABELS in contract-document-obligation-helpers.ts)
 * when the backend provided one; otherwise falls back to the safe,
 * source-derived label. Every other source always uses its safe derived
 * label — never a fabricated specific category.
 */
export function deriveAttachmentCategory(attachment: ContractAttachment): string {
  if (attachment.source === 'DOCUMENT_OBLIGATION' && attachment.documentObligationCategory) {
    const label = DOCUMENT_OBLIGATION_CATEGORY_LABELS[attachment.documentObligationCategory as ContractDocumentObligationCategory];
    if (label) return label;
  }
  return SAFE_CATEGORY_LABEL_BY_SOURCE[attachment.source];
}

/**
 * Every attachment listed here is, by definition, a real uploaded file —
 * "Uploaded" is the only honest status until a real global attachment
 * approval/review workflow exists (it doesn't, anywhere in this app).
 * Never "Approved"/"Pending Review" — that would be a fabricated status.
 */
export const ATTACHMENT_STATUS_LABEL = 'Uploaded';

export interface AttachmentSourceCounts {
  totalFiles: number;
  workflowFiles: number;
  variationFiles: number;
  documentObligationFiles: number;
  closeoutFiles: number;
}

/**
 * Real per-source file counts for the KPI strip — always the FULL,
 * unfiltered list (client-side search/source/date filters only affect the
 * table below, matching the established Claims/Risk/Documents & Obligations
 * KPI-strip pattern). 0 for a contract with no files in that source, never
 * a fabricated number.
 */
export function computeAttachmentSourceCounts(attachments: ContractAttachment[]): AttachmentSourceCounts {
  let workflowFiles = 0;
  let variationFiles = 0;
  let documentObligationFiles = 0;
  let closeoutFiles = 0;

  for (const a of attachments) {
    if (a.source === 'WORKFLOW_TASK') workflowFiles += 1;
    else if (a.source === 'VARIATION') variationFiles += 1;
    else if (a.source === 'DOCUMENT_OBLIGATION') documentObligationFiles += 1;
    else if (a.source === 'CLOSEOUT') closeoutFiles += 1;
  }

  return {
    totalFiles: attachments.length,
    workflowFiles,
    variationFiles,
    documentObligationFiles,
    closeoutFiles,
  };
}
