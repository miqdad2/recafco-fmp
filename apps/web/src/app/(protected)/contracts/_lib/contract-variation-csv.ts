import type { ContractVariation } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';
import { VARIATION_STATUS_LABELS } from './contract-variation-helpers';

export const VARIATION_CSV_HEADERS = [
  'Variation No.', 'Description', 'Amount (KWD)', 'Affects Contract Value', 'Status',
  'Supporting Document', 'Submitted Date', 'Approved Date', 'Remarks',
];

export function variationToCsvRow(v: ContractVariation): string {
  return [
    csvField(v.variationNo),
    csvField(v.description),
    csvField(v.amount),
    csvField(v.affectsContractValue ? 'Yes' : 'No'),
    csvField(VARIATION_STATUS_LABELS[v.status]),
    csvField(v.supportingDocumentName),
    csvField(v.submittedDate),
    csvField(v.approvedDate),
    csvField(v.remarks),
  ].join(',');
}

export function buildVariationsCsv(variations: ContractVariation[]): string {
  const lines = [VARIATION_CSV_HEADERS.map(csvField).join(',')];
  for (const v of variations) lines.push(variationToCsvRow(v));
  return lines.join('\r\n');
}
