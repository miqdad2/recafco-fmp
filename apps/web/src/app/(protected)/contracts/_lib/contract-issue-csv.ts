import type { ContractIssue } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';

export const ISSUE_CSV_HEADERS = [
  'Issue No', 'Contract ID', 'Contract Name', 'Company / Client', 'Issue Title', 'Category', 'Priority',
  'Responsible', 'Raised Date', 'Due Date', 'Overdue Days', 'Status',
];

export function issueToCsvRow(i: ContractIssue): string {
  return [
    csvField(i.issueNo),
    csvField(i.contract.referenceNumber),
    csvField(i.contract.title),
    csvField(i.contract.counterpartyName),
    csvField(i.title),
    csvField(i.category),
    csvField(i.priority),
    csvField(i.responsibleUser?.displayName),
    csvField(i.raisedDate),
    csvField(i.dueDate),
    csvField(i.overdueDays),
    csvField(i.status),
  ].join(',');
}

export function buildIssuesCsv(issues: ContractIssue[]): string {
  const lines = [ISSUE_CSV_HEADERS.map(csvField).join(',')];
  for (const i of issues) lines.push(issueToCsvRow(i));
  return lines.join('\r\n');
}
