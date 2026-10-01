import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Hammer,
  Info,
  PackageSearch,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { fetchMmsLiveDashboard } from '@/lib/mms-api';
import type { MmsLiveDashboard, MmsLiveStatus } from '@/lib/mms-api';
import { MmsLiveControls } from './mms-live-controls';
import { MmsKpiCard } from './mms-kpi-card';
import type { MmsKpiAccent } from './mms-kpi-card';
import { MmsNeedsAttention } from './mms-needs-attention';
import { MmsRecentTable } from './mms-recent-table';
import { MmsSyncStrip } from './mms-sync-strip';
import { MmsQuickActions } from './mms-quick-actions';
import { MmsUnavailableState } from './mms-unavailable-state';
import { MMS_LIVE_STATUS_DISPLAY, formatSyncTime } from '../../_lib/mms-format';

// Used only if the FMP API itself can't be reached (the API normally supplies
// mmsBaseUrl from its MMS_BASE_URL config). Not a secret — the MMS web app URL.
const FALLBACK_MMS_BASE_URL = 'http://192.168.1.17:81';
const DEFAULT_REFRESH_SECONDS = 30;
const OFFLINE_MESSAGE = 'Maintenance MMS is currently unavailable. Live data could not be loaded.';
const NOT_ENABLED_MESSAGE =
  'MMS live integration not enabled. Deploy the MMS live endpoint and set MMS_INTEGRATION_KEY to show live data.';

// ---------------------------------------------------------------------------
// FMP-MAINT-03 — the Maintenance Control Center, shared by the module's two
// entry points: /maintenance/executive (Platform Dashboard card, executive
// sidebar, module switcher — the page most users actually land on, which
// until this unit still showed FMP-local data with quick links and an
// oversized button) and /maintenance/dashboard (department sidebar).
//
// Data: the browser calls the FMP API only (GET /maintenance/dashboard/live),
// which calls MMS's key-authenticated read-only live API server-to-server
// (FMP-MAINT-02). Every number/row is real MMS data or an explicit
// unavailable state — never a placeholder or a fake 0.
// ---------------------------------------------------------------------------

function apiErrorMessage(status: number): string {
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to view Maintenance Management.';
  return OFFLINE_MESSAGE;
}

interface KpiDef {
  label: string;
  value: number | null;
  helperText: string;
  icon: typeof Wrench;
  accent: MmsKpiAccent;
  unavailableText?: string;
}

function buildKpis(d: MmsLiveDashboard | null): KpiDef[] {
  const s = d?.summary ?? null;
  return [
    { label: 'Open Requests', value: s?.openRequests ?? null, helperText: 'Active maintenance workload', icon: Wrench, accent: 'teal' },
    { label: 'In Progress', value: s?.inProgress ?? null, helperText: 'Work currently being handled', icon: Hammer, accent: 'info' },
    { label: 'Waiting For Parts', value: s?.waitingForParts ?? null, helperText: 'Jobs delayed by material/parts', icon: PackageSearch, accent: 'secondary' },
    {
      label: 'Overdue / Past Start Time',
      value: s?.overdue ?? null,
      helperText: 'Based on MMS start time rule',
      icon: AlertTriangle,
      accent: (s?.overdue ?? 0) > 0 ? 'error' : 'warning',
    },
    {
      label: 'Assigned To Me',
      value: s?.assignedToMe ?? null,
      helperText: 'Matched by FMP user email',
      icon: UserCheck,
      accent: 'neutral',
      unavailableText: d?.assignedToMeNote ?? 'Unavailable — FMP user email not set',
    },
    { label: 'Completed This Month', value: s?.completedThisMonth ?? null, helperText: 'Closed this month', icon: CheckCircle2, accent: 'success' },
  ];
}

/** Exactly one banner for any non-ONLINE state. */
function StateBanner({ status, message, mmsBaseUrl }: { status: MmsLiveStatus; message: string | null; mmsBaseUrl: string }): React.JSX.Element | null {
  if (status === 'ONLINE') return null;

  if (status === 'OFFLINE') {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error bg-error-light px-4 py-3 text-sm text-error">
        <span className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="font-semibold">{OFFLINE_MESSAGE}</span>
        </span>
        <a href={mmsBaseUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
          Open MMS
        </a>
      </div>
    );
  }

  const banner =
    status === 'AUTH_ERROR'
      ? { box: 'border-error bg-error-light text-error', text: message ?? 'MMS integration authentication failed.' }
      : status === 'SCOPE_RESTRICTED'
        ? { box: 'border-border-strong bg-surface-secondary text-text-secondary', text: message ?? 'Live MMS data is restricted.' }
        : // NOT_CONFIGURED (no key on FMP) and NOT_ENABLED (MMS endpoint not deployed / key missing on MMS)
          { box: 'border-warning bg-warning-light text-warning', text: NOT_ENABLED_MESSAGE };

  return (
    <div role={status === 'AUTH_ERROR' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${banner.box}`}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{banner.text}</p>
    </div>
  );
}

/** Section placeholder text — specific to WHY there is no live data. */
function unavailableMessage(section: 'attention' | 'recent', status: MmsLiveStatus | null): string {
  if (status === 'NOT_CONFIGURED' || status === 'NOT_ENABLED') {
    return section === 'attention'
      ? 'Live MMS attention items will appear here after the MMS endpoint is deployed.'
      : 'Live MMS recent requests are not available yet.';
  }
  if (status === 'AUTH_ERROR') return 'Live MMS data is unavailable until the MMS integration credentials are corrected.';
  if (status === 'SCOPE_RESTRICTED') return 'Live MMS data is shown only to users with all-department Maintenance access.';
  return 'Live MMS data could not be loaded. It will appear here automatically once MMS is reachable.';
}

function SectionHeading({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
        {children}
      </h2>
      {aside}
    </div>
  );
}

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
  const mmsBaseUrl = dashboard?.mmsBaseUrl ?? FALLBACK_MMS_BASE_URL;
  const refreshSeconds = dashboard?.refreshSeconds ?? DEFAULT_REFRESH_SECONDS;
  // Poll only states that can recover by themselves; config/auth/scope states need an admin.
  const autoRefresh =
    status === 'ONLINE' || status === 'OFFLINE' || (loadError !== null && loadError.status !== 401 && loadError.status !== 403);
  // One "now" per render so every relative time on the page is consistent.
  const now = Date.now();
  const kpis = buildKpis(dashboard);
  const pill = status ? MMS_LIVE_STATUS_DISPLAY[status] : MMS_LIVE_STATUS_DISPLAY.OFFLINE;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-light text-teal">
            <Wrench className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Maintenance Management</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${pill.pill}`}>
                <span className={`size-1.5 rounded-full ${pill.dot}`} aria-hidden="true" />
                {pill.label}
              </span>
              {isOnline && dashboard.generatedAt && (
                <span className="text-xs text-text-muted">Last synced {formatSyncTime(dashboard.generatedAt)}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Live maintenance requests, work orders, parts delays, and technician progress from MMS.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <MmsLiveControls refreshSeconds={refreshSeconds} autoRefresh={autoRefresh} />
          <a
            href={mmsBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Open MMS
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
          {showBackLink && (
            <Link href="/dashboard" className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-secondary">
              Back to Platform Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* Exactly one state banner */}
      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error bg-error-light px-4 py-3 text-sm font-semibold text-error">
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {apiErrorMessage(loadError.status)}
          </span>
          <a href={mmsBaseUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Open MMS
          </a>
        </div>
      ) : (
        status && <StateBanner status={status} message={dashboard?.message ?? null} mmsBaseUrl={mmsBaseUrl} />
      )}

      {/* Sync status strip */}
      <MmsSyncStrip
        status={status}
        detail={dashboard?.message ?? (loadError ? 'The FMP API could not be reached.' : null)}
        generatedAt={dashboard?.generatedAt ?? null}
        cacheTtlSeconds={dashboard?.cacheTtlSeconds ?? null}
        refreshSeconds={refreshSeconds}
        mmsBaseUrl={mmsBaseUrl}
      />

      {/* KPI cards */}
      <section aria-labelledby="mms-kpi-heading" className="space-y-3">
        <SectionHeading id="mms-kpi-heading">Summary</SectionHeading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <MmsKpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              helperText={kpi.helperText}
              icon={kpi.icon}
              accent={kpi.accent}
              hasData={isOnline}
              unavailableText={kpi.unavailableText}
            />
          ))}
        </div>
      </section>

      {/* Needs Attention + Quick Actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="mms-attention-heading" className="space-y-3">
          <SectionHeading
            id="mms-attention-heading"
            aside={
              isOnline && dashboard.needsAttention.length > 0 ? (
                <span className="rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-semibold text-warning">
                  {dashboard.needsAttention.length} item{dashboard.needsAttention.length === 1 ? '' : 's'}
                </span>
              ) : undefined
            }
          >
            Needs Attention
          </SectionHeading>
          {isOnline ? (
            <MmsNeedsAttention items={dashboard.needsAttention} now={now} />
          ) : (
            <MmsUnavailableState message={unavailableMessage('attention', status)} />
          )}
        </section>

        <section aria-labelledby="mms-actions-heading" className="space-y-3">
          <SectionHeading id="mms-actions-heading">Quick Actions</SectionHeading>
          <MmsQuickActions mmsBaseUrl={mmsBaseUrl} />
          <p className="rounded-lg bg-surface-secondary px-3 py-2.5 text-xs leading-relaxed text-text-muted">
            <span className="font-semibold text-text-secondary">Overdue / Past Start Time</span> counts in-flight job cards whose MMS
            start date/time has passed — MMS has no due-date field. MMS is the system of record; create or update job cards in MMS.
          </p>
        </section>
      </div>

      {/* Recent Maintenance Requests */}
      <section aria-labelledby="mms-recent-heading" className="space-y-3">
        <SectionHeading
          id="mms-recent-heading"
          aside={isOnline ? <span className="text-xs text-text-muted">Live from MMS · latest {dashboard.recentRequests.length}</span> : undefined}
        >
          Recent Maintenance Requests
        </SectionHeading>
        {isOnline ? (
          <MmsRecentTable rows={dashboard.recentRequests} now={now} />
        ) : (
          <MmsUnavailableState message={unavailableMessage('recent', status)} />
        )}
      </section>
    </div>
  );
}
