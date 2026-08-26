import type { ScheduleItem } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';

export const SCHEDULE_CSV_HEADERS = [
  'Date', 'Type', 'Contract ID', 'Contract Name', 'Company / Client', 'Schedule Item',
  'Responsible', 'Priority', 'Amount', 'Status', 'Overdue Days',
];

export function scheduleItemToCsvRow(i: ScheduleItem): string {
  return [
    csvField(i.date),
    csvField(i.sourceType),
    csvField(i.contractReference),
    csvField(i.contractTitle),
    csvField(i.companyName),
    csvField(i.title),
    csvField(i.responsibleUser?.displayName),
    csvField(i.priority),
    csvField(i.amount),
    csvField(i.status),
    csvField(i.overdueDays),
  ].join(',');
}

export function buildScheduleCsv(items: ScheduleItem[]): string {
  const lines = [SCHEDULE_CSV_HEADERS.map(csvField).join(',')];
  for (const i of items) lines.push(scheduleItemToCsvRow(i));
  return lines.join('\r\n');
}
