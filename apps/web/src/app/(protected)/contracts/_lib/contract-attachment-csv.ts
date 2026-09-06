import type { ContractAttachment } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';
import { ATTACHMENT_STATUS_LABEL, deriveAttachmentCategory, deriveAttachmentType, formatAttachmentSize } from './contract-attachment-helpers';

export const ATTACHMENT_CSV_HEADERS = [
  'File Name', 'Category', 'Source', 'Related To', 'Uploaded By', 'Uploaded Date', 'Status', 'Type', 'Size',
];

/** Never includes storagePath/downloadPath — only display-safe fields. Columns match the updated table exactly. */
export function attachmentToCsvRow(a: ContractAttachment): string {
  return [
    csvField(a.originalFileName),
    csvField(deriveAttachmentCategory(a)),
    csvField(a.sourceLabel),
    csvField(a.relatedItemTitle),
    csvField(a.uploadedByUser?.displayName),
    csvField(a.createdAt),
    csvField(ATTACHMENT_STATUS_LABEL),
    csvField(deriveAttachmentType(a.mimeType, a.originalFileName)),
    csvField(formatAttachmentSize(a.fileSize)),
  ].join(',');
}

export function buildAttachmentsCsv(attachments: ContractAttachment[]): string {
  const lines = [ATTACHMENT_CSV_HEADERS.map(csvField).join(',')];
  for (const a of attachments) lines.push(attachmentToCsvRow(a));
  return lines.join('\r\n');
}
