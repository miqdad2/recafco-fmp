import type { ContractScheduleOverviewRow } from '@/lib/contracts-api';
import { csvField } from './contract-payment-csv';

export const SCHEDULE_OVERVIEW_CSV_HEADERS = [
  'Contract No', 'Job Order No', 'Project', 'Client', 'Contract Status', 'Schedule Status',
  'Current Stage', 'Next Milestone', 'Next Milestone Date', 'Planned Finish', 'Actual / Forecast Finish',
  'Delay (Days)', 'Blocking Team', 'Blocking Stage', 'Completed Stages', 'Total Stages',
];

export function scheduleOverviewRowToCsvRow(row: ContractScheduleOverviewRow): string {
  return [
    csvField(row.contractNumber),
    csvField(row.jobOrderNumber),
    csvField(row.projectName),
    csvField(row.clientName),
    csvField(row.contractStatus),
    csvField(row.scheduleStatus),
    csvField(row.currentStage),
    csvField(row.nextMilestone),
    csvField(row.nextMilestoneDate),
    csvField(row.plannedFinishDate),
    csvField(row.actualOrForecastFinishDate),
    csvField(row.delayDays),
    csvField(row.blockingTeam),
    csvField(row.blockingStage),
    csvField(row.completedStages),
    csvField(row.totalStages),
  ].join(',');
}

export function buildScheduleOverviewCsv(rows: ContractScheduleOverviewRow[]): string {
  const lines = [SCHEDULE_OVERVIEW_CSV_HEADERS.map(csvField).join(',')];
  for (const row of rows) lines.push(scheduleOverviewRowToCsvRow(row));
  return lines.join('\r\n');
}
