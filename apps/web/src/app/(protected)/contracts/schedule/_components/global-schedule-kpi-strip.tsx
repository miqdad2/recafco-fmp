import { FolderKanban, CheckCircle2, AlertTriangle, CircleDashed, CalendarClock, BadgeCheck, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ContractScheduleOverviewSummary } from '@/lib/contracts-api';

interface Props {
  summary: ContractScheduleOverviewSummary | null;
}

interface KpiCardProps {
  label: string;
  helper: string;
  value: number | undefined;
  icon: LucideIcon;
  /** Subtle status accent: icon tile background + icon colour + top rule. */
  tile: string;
  rule: string;
  available: boolean;
}

function KpiCard({ label, helper, value, icon: Icon, tile, rule, available }: KpiCardProps): React.JSX.Element {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-border border-t-2 ${rule} bg-surface p-4 shadow-sm`}>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${tile}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-text-primary">{available ? (value ?? '—') : '—'}</p>
        <p className="mt-1 truncate text-sm font-medium text-text-secondary">{label}</p>
        {available ? (
          <p className="truncate text-xs text-text-muted">{helper}</p>
        ) : (
          <p className="inline-flex items-center gap-1 text-xs text-text-muted">
            <WifiOff className="size-3" aria-hidden="true" />
            Unavailable
          </p>
        )}
      </div>
    </div>
  );
}

/** Presentation only — every value comes straight from the server-computed summary. */
export function GlobalScheduleKpiStrip({ summary }: Props): React.JSX.Element {
  const available = summary !== null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard label="Total Active Contracts" helper="In planning scope" value={summary?.totalActiveContracts} icon={FolderKanban} tile="bg-surface-secondary text-text-secondary" rule="border-t-border-strong" available={available} />
      <KpiCard label="On Track" helper="No delay detected" value={summary?.onTrack} icon={CheckCircle2} tile="bg-info-light text-info" rule="border-t-info" available={available} />
      <KpiCard label="Delayed" helper="Needs follow-up" value={summary?.delayed} icon={AlertTriangle} tile="bg-error-light text-error" rule="border-t-error" available={available} />
      <KpiCard label="Not Planned" helper="Schedule not added" value={summary?.notPlanned} icon={CircleDashed} tile="bg-surface-secondary text-text-muted" rule="border-t-border" available={available} />
      <KpiCard label="Due This Week" helper="Planned milestones due soon" value={summary?.dueThisWeek} icon={CalendarClock} tile="bg-warning-light text-warning" rule="border-t-warning" available={available} />
      <KpiCard label="Completed This Month" helper="Finished milestones" value={summary?.completedThisMonth} icon={BadgeCheck} tile="bg-success-light text-success" rule="border-t-success" available={available} />
    </div>
  );
}
