import type { ContractDocumentObligation } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';
import { DOCUMENT_OBLIGATION_CATEGORY_LABELS, DOCUMENT_OBLIGATION_STATUS_LABELS } from './contract-document-obligation-helpers';

export const DOCUMENT_OBLIGATION_CSV_HEADERS = [
  'Item ID', 'Document / Obligation', 'Category', 'Responsible Party', 'Required Date',
  'Submission Date', 'Expiry Date', 'Days Remaining', 'Status', 'Remarks', 'Attachment', 'Last Update',
];

/** Attachment field is a plain list of real uploaded file names — never a raw storage path. */
export function documentObligationToCsvRow(item: ContractDocumentObligation): string {
  return [
    csvField(item.itemNo),
    csvField(item.title),
    csvField(DOCUMENT_OBLIGATION_CATEGORY_LABELS[item.category]),
    csvField(item.responsibleParty),
    csvField(item.requiredDate),
    csvField(item.submissionDate),
    csvField(item.expiryDate),
    csvField(item.daysRemaining),
    csvField(DOCUMENT_OBLIGATION_STATUS_LABELS[item.status]),
    csvField(item.remarks),
    csvField(item.attachments.length > 0 ? item.attachments.map((a) => a.originalFileName).join('; ') : undefined),
    csvField(item.updatedAt),
  ].join(',');
}

export function buildDocumentObligationsCsv(items: ContractDocumentObligation[]): string {
  const lines = [DOCUMENT_OBLIGATION_CSV_HEADERS.map(csvField).join(',')];
  for (const item of items) lines.push(documentObligationToCsvRow(item));
  return lines.join('\r\n');
}
