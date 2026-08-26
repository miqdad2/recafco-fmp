import type { CloseoutListItem } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';

export const CLOSEOUT_CSV_HEADERS = [
  'Request No', 'Contract ID', 'Contract Name', 'Company / Client', 'Requested By', 'Requested Date',
  'Status', 'Workflow Open', 'Issues Open', 'Claims Open', 'Outstanding Payment', 'Documents',
  'Reviewed By', 'Reviewed Date', 'Approved Date', 'Rejected Date', 'Closed Date',
];

export function closeoutToCsvRow(c: CloseoutListItem): string {
  return [
    csvField(c.requestNo),
    csvField(c.contractReference),
    csvField(c.contractTitle),
    csvField(c.companyName),
    csvField(c.requestedBy.displayName),
    csvField(c.requestedAt),
    csvField(c.status),
    csvField(c.riskSnapshot?.openWorkflowTasksCount),
    csvField(c.riskSnapshot?.openIssuesCount),
    csvField(c.riskSnapshot?.openClaimsCount),
    csvField(c.riskSnapshot?.outstandingPaymentAmount),
    csvField(c.attachmentsCount),
    csvField(c.reviewedBy?.displayName),
    csvField(c.reviewedAt),
    csvField(c.approvedAt),
    csvField(c.rejectedAt),
    csvField(c.closedAt),
  ].join(',');
}

export function buildCloseoutsCsv(items: CloseoutListItem[]): string {
  const lines = [CLOSEOUT_CSV_HEADERS.map(csvField).join(',')];
  for (const c of items) lines.push(closeoutToCsvRow(c));
  return lines.join('\r\n');
}
