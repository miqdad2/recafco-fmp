import type { ContractClaim } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';

export const CLAIM_CSV_HEADERS = [
  'Claim No', 'Contract ID', 'Contract Name', 'Company / Client', 'Claim Title', 'Claim Type',
  'Submitted Value', 'Approved Value', 'Outstanding Value', 'EOT Claimed', 'EOT Approved',
  'Responsible', 'Next Action', 'Due Date', 'Overdue Days', 'Status',
];

export function claimToCsvRow(c: ContractClaim): string {
  return [
    csvField(c.claimNo),
    csvField(c.contract.referenceNumber),
    csvField(c.contract.title),
    csvField(c.contract.counterpartyName),
    csvField(c.claimTitle),
    csvField(c.claimType),
    csvField(c.submittedValue),
    csvField(c.approvedValue),
    csvField(c.outstandingValue),
    csvField(c.eotClaimedDays),
    csvField(c.eotApprovedDays),
    csvField(c.responsibleUser?.displayName),
    csvField(c.nextAction),
    csvField(c.dueDate),
    csvField(c.overdueDays),
    csvField(c.status),
  ].join(',');
}

export function buildClaimsCsv(claims: ContractClaim[]): string {
  const lines = [CLAIM_CSV_HEADERS.map(csvField).join(',')];
  for (const c of claims) lines.push(claimToCsvRow(c));
  return lines.join('\r\n');
}
