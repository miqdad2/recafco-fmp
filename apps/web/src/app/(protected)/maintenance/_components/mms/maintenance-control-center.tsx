import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  HardHat,
  Info,
  PackageSearch,
  Timer,
  Truck,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fetchMmsLiveDashboard } from '@/lib/mms-api';
import type { MmsLiveDashboard, MmsLiveStatus } from '@/lib/mms-api';
import { MmsLiveControls } from './mms-live-controls';
import { MmsCard, MmsCardNote } from './mms-card';
import { MmsKpiCard } from './mms-kpi-card';
import type { MmsKpiAccent } from './mms-kpi-card';
import { ATTENTION_LIMIT, MmsManagerAttention } from './mms-manager-attention';
import { MmsModulesSummary } from './mms-modules-summary';
import { MmsRecentTable, RECENT_LIMIT } from './mms-recent-table';
import { MmsQuickActions } from './mms-quick-actions';
import { MMS_LIVE_STATUS_DISPLAY, fallbackMmsLinks, formatHours, formatSyncTime } from '../../_lib/mms-format';

// FMP-MAINT-06 — the PUBLIC Maintenance Management System address. Every
// link a user can click points here. The FMP API normally supplies it (from
// MMS_PUBLIC_BASE_URL); this constant is only used if the FMP API itself
// can't be reached. The internal address the API uses to call MMS is never
// sent to the browser.
const FALLBACK_MMS_PUBLIC_URL = 'https://maintenance.recafco.online';
/** User-facing wording: most users don't know what "MMS" means. */
const OPEN_SYSTEM_LABEL = 'Open Maintenance Management System';
const OPEN_SYSTEM_LABEL_SHORT = 'Open Maintenance System';
const DEFAULT_REFRESH_SECONDS = 30;
const OFFLINE_MESSAGE = 'Maintenance MMS is currently unavailable. Live data could not be loaded.';
const NOT_ENABLED_MESSAGE =
  'MMS live integration not enabled. Deploy the MMS live endpoint and set MMS_INTEGRATION_KEY to show live data.';

// ---------------------------------------------------------------------------
// FMP-MAINT-03 — the Maintenance Control Center, shared by the module's two
// entry points: /maintenance/executive (Platform Dashboard card, executive
// sidebar, module switcher) and /maintenance/dashboard (department sidebar).
//
// FMP-MAINT-04 — expanded from a job-card dashboard into a live executive
// summary of the whole MMS: job cards, materials requests, inventory, assets,
// vehicle expiry, and labor, with MMS's Manager Attention up front.
//
// Data: the browser calls the FMP API only (GET /maintenance/dashboard/live),
// which calls MMS's key-authenticated read-only live API server-to-server
// (FMP-MAINT-02). Every number/row is real MMS data or an explicit
// unavailable state — never a placeholder or a fake 0.
//
// FMP-MAINT-05 — one-screen executive layout. MAINT-04 stacked nine blocks
// (header, banner, sync strip, two KPI rows, two attention lists, quick
// actions, a full recent table, five expanded module panels) and read as a
// long report. Now: a slim header, two slim KPI rows, and one two-column
// grid — Manager Attention (top 5) + Recent Requests (latest 5) on the left,
// Quick Actions (2x3) + a five-row module summary on the right. Why there
// is no live data is said ONCE, in the single banner; cards show "—" and
// sections a short muted line. Details live in MMS, one click away.
// ---------------------------------------------------------------------------

function apiErrorMessage(status: number): string {
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to view Maintenance Management.';
  return OFFLINE_MESSAGE;
}

interface KpiDef {
  label: string;
  value: number | null;
  display?: string;
  helperText: string;
  icon: LucideIcon;
  accent: MmsKpiAccent;
}

const alertAccent = (n: number | null | undefined, hot: MmsKpiAccent, calm: MmsKpiAccent): MmsKpiAccent => ((n ?? 0) > 0 ? hot : calm);

/** The six headline numbers a manager acts on. */
function buildPrimaryKpis(d: MmsLiveDashboard | null): KpiDef[] {
  return [
    { label: 'Active Jobs', value: d?.jobCards?.activeJobs ?? null, helperText: 'Job cards being worked on', icon: Wrench, accent: 'teal' },
    {
      label: 'Closure Requests',
      value: d?.jobCards?.closureRequests ?? null,
      helperText: 'Awaiting manager closure',
      icon: ClipboardCheck,
      accent: alertAccent(d?.jobCards?.closureRequests, 'warning', 'neutral'),
    },
    {
      label: 'Materials Pending',
      value: d?.materialsRequests?.materialsPending ?? null,
      helperText: 'Job cards waiting on materials',
      icon: PackageSearch,
      accent: alertAccent(d?.materialsRequests?.materialsPending, 'secondary', 'neutral'),
    },
    {
      label: 'Low Stock / Needs Attention',
      value: d?.inventory?.lowStockCount ?? null,
      helperText: 'Low, out of, or negative stock',
      icon: Boxes,
      accent: alertAccent(d?.inventory?.lowStockCount, 'warning', 'neutral'),
    },
    { label: 'Total Assets', value: d?.assets?.totalAssets ?? null, helperText: 'Registered assets & equipment', icon: Truck, accent: 'info' },
    {
      label: 'Vehicle Expiry Alerts',
      value: d?.vehicleCompliance?.vehicleExpiryAlerts ?? null,
      helperText: 'Insurance / registration expiring',
      icon: CarFront,
      accent: alertAccent(d?.vehicleCompliance?.vehicleExpiryAlerts, 'error', 'neutral'),
    },
  ];
}

function buildSecondaryKpis(d: MmsLiveDashboard | null): KpiDef[] {
  const hours = d?.labor?.laborHoursToday ?? null;
  return [
    { label: 'Total Job Cards', value: d?.jobCards?.totalJobCards ?? null, helperText: '', icon: ClipboardList, accent: 'neutral' },
    { label: 'Materials Requests', value: d?.materialsRequests?.totalMaterialsRequests ?? null, helperText: '', icon: PackageSearch, accent: 'neutral' },
    { label: 'Inventory Items', value: d?.inventory?.totalMaterials ?? null, helperText: '', icon: Boxes, accent: 'neutral' },
    { label: 'Working Now', value: d?.labor?.workingNow ?? null, helperText: '', icon: HardHat, accent: 'success' },
    { label: 'Labor Hours Today', value: hours, ...(hours !== null ? { display: formatHours(hours) } : {}), helperText: '', icon: Timer, accent: 'info' },
    // From the original job-card summary, so it is present for every MMS build.
    { label: 'Completed This Month', value: d?.summary?.completedThisMonth ?? null, helperText: '', icon: CheckCircle2, accent: 'success' },
  ];
}

/**
 * Exactly one compact banner for any non-ONLINE state — the only place the
 * reason for missing live data is spelled out. `detail` is the FMP API's own
 * specific explanation (never contains secrets).
 */
function StateBanner({ status, detail, mmsPublicUrl }: { status: MmsLiveStatus; detail: string | null; mmsPublicUrl: string }): React.JSX.Element | null {
  if (status === 'ONLINE') return null;

  const isError = status === 'OFFLINE' || status === 'AUTH_ERROR';
  const box = isError
    ? 'border-error bg-error-light text-error'
    : status === 'SCOPE_RESTRICTED'
      ? 'border-border-strong bg-surface-secondary text-text-secondary'
      : 'border-warning bg-warning-light text-warning';
  // Said once. OFFLINE / AUTH_ERROR / SCOPE_RESTRICTED: the FMP API's own sentence
  // already is the full message. NOT_CONFIGURED / NOT_ENABLED: the fixed
  // instruction, plus only the specific reason after the API message's dash.
  let headline: string;
  let reason: string | null = null;
  if (status === 'NOT_CONFIGURED' || status === 'NOT_ENABLED') {
    headline = NOT_ENABLED_MESSAGE;
    const dash = detail?.indexOf('—') ?? -1;
    if (detail && dash !== -1) reason = detail.slice(dash + 1).trim();
  } else if (status === 'OFFLINE') {
    headline = detail ?? OFFLINE_MESSAGE;
  } else if (status === 'AUTH_ERROR') {
    headline = detail ?? 'MMS integration authentication failed.';
  } else {
    headline = detail ?? 'Live MMS data is restricted.';
  }
  const Icon = isError ? AlertTriangle : Info;

  return (
    <div role={isError ? 'alert' : 'status'} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-3.5 py-2 text-[13px] ${box}`}>
      <span className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">{headline}</span>
          {reason && <span className="opacity-90"> Reason: {reason}</span>}
        </span>
      </span>
      <a href={mmsPublicUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold underline">
        {OPEN_SYSTEM_LABEL_SHORT}
      </a>
    </div>
  );
}

/** Short section note when there is no live data — the banner carries the detail. */
const NO_LIVE_DATA = 'No live data.';

interface Props {
  /** false on /maintenance/executive, whose ExecutiveModuleNav row already has this exact link directly above the header. */
  showBackLink?: boolean;
}

export async function MaintenanceControlCenter({ showBackLink = true }: Props = {}): Promise<React.JSX.Element> {
  const result = await fetchMmsLiveDashboard();
  const dashboard = result.data;
  const loadError = result.error;

  const status = dashboard?.status ?? null;
  const isOnline = status === 'ONLINE' && dashboard !== null;
  const mmsPublicUrl = dashboard?.mmsPublicBaseUrl ?? FALLBACK_MMS_PUBLIC_URL;
  // Real MMS routes: from the FMP API when reachable, otherwise built on the fallback MMS address.
  const links = dashboard?.links ?? fallbackMmsLinks(mmsPublicUrl);
  const refreshSeconds = dashboard?.refreshSeconds ?? DEFAULT_REFRESH_SECONDS;
  // Poll only states that can recover by themselves; config/auth/scope states need an admin.
  const autoRefresh =
    status === 'ONLINE' || status === 'OFFLINE' || (loadError !== null && loadError.status !== 401 && loadError.status !== 403);
  // One "now" per render so every relative time on the page is consistent.
  const now = Date.now();
  const pill = status ? MMS_LIVE_STATUS_DISPLAY[status] : MMS_LIVE_STATUS_DISPLAY.OFFLINE;
  const managerAttention = isOnline ? dashboard.managerAttention : null;
  const attentionTotal = managerAttention?.needsManagerAttention ?? (isOnline ? dashboard.needsAttention.length : 0);
  const recentCount = isOnline ? Math.min(dashboard.recentRequests.length, RECENT_LIMIT) : 0;
  const smallLink = 'inline-flex items-center gap-0.5 text-xs font-semibold text-accent hover:underline';

  return (
    <div className="space-y-2.5">
      {/* Compact header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5 shadow-sm">
        <div className="flex min-w-0 flex-1 basis-80 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-light text-teal">
            <Wrench className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-text-primary">Maintenance Management</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${pill.pill}`}>
                <span className={`size-2 rounded-full ${pill.dot}`} aria-hidden="true" />
                {pill.label}
              </span>
              {isOnline && dashboard.generatedAt && (
                <span className="text-xs text-text-secondary">
                  Last synced {formatSyncTime(dashboard.generatedAt)} · auto-refresh {refreshSeconds} s
                </span>
              )}
            </div>
            <p className="truncate text-[13px] text-text-secondary" title="Live MMS overview for job cards, materials, inventory, assets, vehicles, and labor.">
              Live MMS overview for job cards, materials, inventory, assets, vehicles, and labor.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <MmsLiveControls refreshSeconds={refreshSeconds} autoRefresh={autoRefresh} />
          <a
            href={mmsPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {OPEN_SYSTEM_LABEL}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
          {showBackLink && (
            <Link
              href="/dashboard"
              title="Back to Platform Dashboard"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-secondary"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Platform Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* Exactly one state banner (nothing when online) */}
      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error bg-error-light px-3.5 py-2 text-[13px] font-semibold text-error">
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {apiErrorMessage(loadError.status)}
          </span>
          <a href={mmsPublicUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {OPEN_SYSTEM_LABEL_SHORT}
          </a>
        </div>
      ) : (
        status && <StateBanner status={status} detail={dashboard?.message ?? null} mmsPublicUrl={mmsPublicUrl} />
      )}

      {/* KPI rows: six headline tiles, then six mini-stats */}
      <section aria-label="Executive summary" className="space-y-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {buildPrimaryKpis(dashboard).map((kpi) => (
            <MmsKpiCard key={kpi.label} {...kpi} hasData={isOnline} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {buildSecondaryKpis(dashboard).map((kpi) => (
            <MmsKpiCard key={kpi.label} {...kpi} hasData={isOnline} compact />
          ))}
        </div>
      </section>

      {/* Main grid: attention + recent (left), actions + modules (right) */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <MmsCard
            id="mms-attention-heading"
            title="Manager Attention"
            className="flex-1"
            aside={
              isOnline && attentionTotal > 0 ? (
                <span className="rounded-full bg-warning-light px-2.5 py-0.5 text-xs font-bold text-warning">
                  {attentionTotal} need attention · top {ATTENTION_LIMIT}
                </span>
              ) : undefined
            }
          >
            {isOnline ? (
              <MmsManagerAttention attention={managerAttention} jobCardAttention={dashboard.needsAttention} links={links} />
            ) : (
              <MmsCardNote>{NO_LIVE_DATA}</MmsCardNote>
            )}
          </MmsCard>

          <MmsCard
            id="mms-recent-heading"
            title="Recent Maintenance Requests"
            className={recentCount > 0 || !isOnline ? 'flex-1' : ''}
            aside={
              <a href={links.jobCards} target="_blank" rel="noopener noreferrer" className={smallLink}>
                {recentCount > 0 ? `Latest ${recentCount} · all job cards` : 'All job cards'}
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            }
          >
            {isOnline ? <MmsRecentTable rows={dashboard.recentRequests} now={now} /> : <MmsCardNote>{NO_LIVE_DATA}</MmsCardNote>}
          </MmsCard>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5">
          <MmsCard
            id="mms-actions-heading"
            title="Quick Actions"
            aside={
              <Link href="/maintenance" className={smallLink} title="FMP local maintenance records (not MMS)">
                FMP local requests
              </Link>
            }
          >
            <MmsQuickActions links={links} />
          </MmsCard>

          <MmsCard id="mms-modules-heading" title="MMS Modules Summary" className="flex-1">
            <MmsModulesSummary dashboard={dashboard} links={links} />
          </MmsCard>
        </div>
      </div>

      <p className="hidden text-center text-xs leading-none text-text-secondary [@media(min-height:900px)]:block">
        Source: MMS Live API · read-only
        {isOnline && dashboard.cacheTtlSeconds !== null ? ` · cache ${dashboard.cacheTtlSeconds}s` : ''} · MMS is the system of record
      </p>
    </div>
  );
}
