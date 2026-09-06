import { Gauge, CalendarCheck2, CalendarClock, AlertTriangle, CheckCircle2, ListTodo } from 'lucide-react';
import { DashboardKpiCard } from '../../../../../contracts/dashboard/_components/dashboard-kpi-card';
import type { MetricStatus } from '../../../../../_components/metric-card';
import type { ContractScheduleSummaryData } from '@/lib/contracts-api';
import { formatScheduleDate, formatDelayDays, delayDaysClassName } from '../../../../_lib/contract-schedule-detail-helpers';

interface Props {
  summary: ContractScheduleSummaryData;
  hasPlannedSchedule: boolean;
}

// CM-68A — "Not Planned" deliberately uses the same neutral `info` icon
// accent as "On Track" rather than `accent` (this theme's brand red,
// reserved for primary actions/genuinely urgent states per the CM-64C
// finding) — having no plan yet is not an alarming condition.
const SCHEDULE_STATUS_ACCENT: Record<ContractScheduleSummaryData['scheduleStatus'], { accent: 'info' | 'teal' | 'success' | 'error'; valueClassName: string }> = {
  'Not Planned': { accent: 'info', valueClassName: 'text-text-muted' },
  'On Track': { accent: 'info', valueClassName: 'text-info' },
  'In Progress': { accent: 'teal', valueClassName: 'text-teal' },
  Completed: { accent: 'success', valueClassName: 'text-success' },
  Delayed: { accent: 'error', valueClassName: 'text-error' },
};

/**
 * CM-68A — Readiness KPI strip for the Planned vs Actual Schedule tab. Every
 * value is real: scheduleStatus/plannedCompletionDate/
 * actualOrForecastCompletionDate/delayDays/completedStages/pendingStages all
 * come straight from ContractSchedulePlanService.computeScheduleSummary() —
 * no client-side recomputation, no invented percentage.
 */
export function ContractScheduleKpiStrip({ summary, hasPlannedSchedule }: Props): React.JSX.Element {
  const statusTone = SCHEDULE_STATUS_ACCENT[summary.scheduleStatus];
  const status: MetricStatus = hasPlannedSchedule ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <DashboardKpiCard
        label="Schedule Status"
        value={hasPlannedSchedule ? summary.scheduleStatus : undefined}
        icon={Gauge}
        accent={statusTone.accent}
        valueClassName={statusTone.valueClassName}
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Planned Completion"
        value={hasPlannedSchedule ? formatScheduleDate(summary.plannedCompletionDate) : undefined}
        icon={CalendarClock}
        accent="info"
        valueClassName="text-info"
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Forecast / Actual Completion"
        value={hasPlannedSchedule ? formatScheduleDate(summary.actualOrForecastCompletionDate) : undefined}
        icon={CalendarCheck2}
        accent="teal"
        valueClassName="text-teal"
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Delay Days"
        value={hasPlannedSchedule ? formatDelayDays(summary.delayDays) : undefined}
        icon={AlertTriangle}
        accent="error"
        valueClassName={delayDaysClassName(summary.delayDays)}
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Completed Stages"
        value={hasPlannedSchedule ? `${summary.completedStages} / ${summary.totalStages}` : undefined}
        icon={CheckCircle2}
        accent="success"
        valueClassName="text-success"
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Pending Stages"
        value={hasPlannedSchedule ? summary.pendingStages : undefined}
        icon={ListTodo}
        accent="warning"
        valueClassName="text-warning"
        status={status}
        dense
      />
    </div>
  );
}
