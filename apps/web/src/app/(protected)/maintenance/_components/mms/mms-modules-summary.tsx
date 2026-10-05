import { ArrowUpRight, Boxes, CarFront, ClipboardList, HardHat, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MmsLinks, MmsLiveDashboard } from '@/lib/mms-api';
import { formatHours } from '../../_lib/mms-format';

interface Props {
  /** null = no live data at all (offline / not configured / restricted). */
  dashboard: MmsLiveDashboard | null;
  links: MmsLinks;
}

interface Stat {
  label: string;
  /** null = MMS did not send this value → "—". */
  value: number | string | null;
  /** Highlight a non-zero problem count. */
  alert?: boolean;
}

interface ModuleRow {
  title: string;
  icon: LucideIcon;
  href: string;
  /** null = MMS (online) did not send this whole section. */
  stats: Stat[] | null;
}


/** Builds the five module rows from whatever sections MMS sent. Exported for tests. */
export function buildModuleRows(d: MmsLiveDashboard | null, links: MmsLinks): ModuleRow[] {
  const jc = d?.jobCards ?? null;
  const mr = d?.materialsRequests ?? null;
  const inv = d?.inventory ?? null;
  const assets = d?.assets ?? null;
  const veh = d?.vehicleCompliance ?? null;
  const labor = d?.labor ?? null;

  return [
    {
      title: 'Job Cards',
      icon: ClipboardList,
      href: links.jobCards,
      // waitingForParts comes from the original job-card summary, present on every MMS build.
      stats:
        jc || d?.summary
          ? [
              { label: 'Active', value: jc?.activeJobs ?? null },
              { label: 'In progress', value: jc?.inProgress ?? d?.summary?.inProgress ?? null },
              { label: 'Waiting parts', value: d?.summary?.waitingForParts ?? null, alert: true },
            ]
          : null,
    },
    {
      title: 'Materials & Inventory',
      icon: Boxes,
      href: links.inventory,
      stats:
        mr || inv
          ? [
              { label: 'Pending', value: mr?.pendingMaterialsRequests ?? null, alert: true },
              { label: 'Low stock', value: inv?.lowStockCount ?? null, alert: true },
              { label: 'Materials', value: inv?.totalMaterials ?? null },
            ]
          : null,
    },
    {
      title: 'Assets & Equipment',
      icon: Truck,
      href: links.assets,
      stats: assets
        ? [
            { label: 'Total', value: assets.totalAssets },
            { label: 'In maint.', value: assets.activeMaintenance },
            { label: 'At site', value: assets.assetsAtSite },
          ]
        : null,
    },
    {
      title: 'Vehicle Expiry',
      icon: CarFront,
      href: links.vehicles,
      stats: veh
        ? [
            { label: 'Expired', value: veh.expiredCount, alert: true },
            { label: 'Expiring', value: veh.expiringSoon, alert: true },
            { label: 'Alerts', value: veh.vehicleExpiryAlerts },
          ]
        : null,
    },
    {
      title: 'Labor Snapshot',
      icon: HardHat,
      href: links.workerActivity,
      stats: labor
        ? [
            { label: 'Working', value: labor.workingNow },
            { label: 'Today', value: formatHours(labor.laborHoursToday) },
            { label: 'KWD', value: labor.laborCostTodayKwd === null ? null : labor.laborCostTodayKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) },
          ]
        : null,
    },
  ];
}

// FMP-MAINT-05 — replaces MAINT-04's five expanded module panels (the main
// cause of the long page) with five one-line summary rows: title, three key
// values, and the row itself is the "open in MMS" link. Detail lives in MMS.
// - No live data at all: values show "—" (the page's single banner says why).
// - MMS online but a section missing: one muted "Not available yet".
export function MmsModulesSummary({ dashboard, links }: Props): React.JSX.Element {
  const online = dashboard?.status === 'ONLINE';
  const rows = buildModuleRows(online ? dashboard : null, links);

  return (
    <ul className="divide-y divide-border">
      {rows.map(({ title, icon: Icon, href, stats }) => (
        <li key={title}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${title} in the Maintenance Management System`}
            className="group flex items-center gap-2.5 px-3.5 py-1 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-light text-teal">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-tight text-text-primary">{title}</p>
              {online && stats === null ? (
                <p className="text-[11px] text-text-muted">Not available yet</p>
              ) : (
                <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)] gap-2">
                  {(stats ?? DASH_STATS[title] ?? []).map(({ label, value, alert }) => (
                    <div key={label} className="flex min-w-0 flex-row-reverse items-baseline justify-end gap-1">
                      <dt className="truncate text-[11px] text-text-secondary">{label}</dt>
                      <dd
                        className={`shrink-0 text-sm font-bold tabular-nums leading-tight ${
                          alert && typeof value === 'number' && value > 0 ? 'text-warning' : 'text-text-primary'
                        }`}
                      >
                        {value ?? '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <ArrowUpRight className="size-3.5 shrink-0 text-text-muted group-hover:text-accent" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

// Labels with "—" values, shown when there is no live data at all so the rows keep their shape.
const DASH_STATS: Record<string, Stat[]> = {
  'Job Cards': [
    { label: 'Active', value: null },
    { label: 'In progress', value: null },
    { label: 'Waiting parts', value: null },
  ],
  'Materials & Inventory': [
    { label: 'Pending', value: null },
    { label: 'Low stock', value: null },
    { label: 'Materials', value: null },
  ],
  'Assets & Equipment': [
    { label: 'Total', value: null },
    { label: 'In maint.', value: null },
    { label: 'At site', value: null },
  ],
  'Vehicle Expiry': [
    { label: 'Expired', value: null },
    { label: 'Expiring', value: null },
    { label: 'Alerts', value: null },
  ],
  'Labor Snapshot': [
    { label: 'Working', value: null },
    { label: 'Today', value: null },
    { label: 'KWD', value: null },
  ],
};
