import type { ContractActivity } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';
import { activityActionLabel, activitySource, activityDetails, activityOldValue, activityNewValue } from './contract-activity-helpers';

export const ACTIVITY_CSV_HEADERS = ['Date & Time', 'User', 'Activity / Action', 'Source', 'Details', 'Old Value', 'New Value'];

/** Never includes raw metadata JSON or internal IDs — only display-safe, already-derived fields. */
export function activityToCsvRow(a: ContractActivity): string {
  const oldValue = activityOldValue(a);
  const newValue = activityNewValue(a);
  return [
    csvField(a.createdAt),
    csvField(a.actorName ?? 'System'),
    csvField(activityActionLabel(a.event)),
    csvField(activitySource(a.event)),
    csvField(activityDetails(a)),
    csvField(oldValue === '—' ? undefined : oldValue),
    csvField(newValue === '—' ? undefined : newValue),
  ].join(',');
}

export function buildActivitiesCsv(activities: ContractActivity[]): string {
  const lines = [ACTIVITY_CSV_HEADERS.map(csvField).join(',')];
  for (const a of activities) lines.push(activityToCsvRow(a));
  return lines.join('\r\n');
}
