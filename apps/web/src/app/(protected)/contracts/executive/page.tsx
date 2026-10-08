import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Activity, ClipboardCheck, Wallet, Receipt, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { ContractDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { fetchBoqConfirmations } from '@/lib/technical-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { RefreshButton } from '../../technical/_components/refresh-button';
import { DashboardKpiCard } from '../../_components/dashboard-kpi-card';
import { DashboardNeedsAttentionPanel } from '../../_components/dashboard-needs-attention-panel';
import type { DashboardAttentionRow } from '../../_components/dashboard-needs-attention-panel';
import {
  pickDefaultContractId,
  buildTodaysFocus,
  buildNeedsAttentionRows,
} from './_lib/dashboard-selector-helpers';
import { ContractDashboardLeftColumn } from './_components/contract-dashboard-left-column';
import type { RecentContractRow, SelectedContractBasics } from './_components/contract-dashboard-left-column';

export const metadata: Metadata = { title: 'Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 → FMP-UI-07C → FMP-UI-07D → FMP-UI-16 → FMP-UI-16B → FMP-UI-16D —
 * see this file's git history / progress-tracker.md for the long chain of
 * polish passes this page went through before this unit. All of that is
 * superseded by this rewrite; the short version of what carries over:
 * `ExecutiveModuleNav` (shared chrome, unchanged), `contracts.read` gate
 * (unchanged), and reusing `contractsApi.dashboard()` as the one data
 * source for everything that isn't BOQ piece data (unchanged).
 *
 * FMP-UI-29 — full redesign per a direct "too narrow, too empty, not
 * impressive enough" report: the centered `max-w-6xl` layout, the large
 * top "Quick Actions" box, the basic "Recent Contract Updates" table, and
 * the complete absence of BOQ piece progress are all replaced with:
 *   1. Full-width header with compact actions (no more big Quick Actions box).
 *   2. A Contract/Project selector (search + Recent Contracts row click),
 *      with a Selected Contract Progress card showing the real
 *      Confirmed→Generated→Produced→Delivered→Erected→Completed flow for
 *      whichever contract is selected — `ContractDashboardLeftColumn`
 *      (the one client component on this page) owns that selection state.
 *   3. A 6-card KPI row.
 *   4. An Overall BOQ Piece Progress card — the SAME flow, summed across
 *      every contract this actor can see, from the new
 *      `ContractBoqPieceOverview` the API now returns alongside the rest
 *      of the manager dashboard (see contract-dashboard.service.ts's own
 *      doc comment on `buildBoqPieceOverview()` for exactly how).
 *   5. Needs Attention, now 6 named rows (was 4), always shown even at 0.
 *   6. Today's Focus — up to 5 of the SAME real figures already on this
 *      page, filtered to the non-zero ones; never a separate computation.
 * Every number keeps coming from data this app already computes — nothing
 * here is invented, and nothing writes anything. No Technical/BOQ file is
 * touched; no route, permission, or workflow logic changed.
 *
 * Two things the ticket asked for were deliberately left out, both
 * because nothing real exists for them (see this unit's own "do not add a
 * broken button" / "do not invent" instructions):
 *   - "View All BOQ Progress": no global (cross-contract) BOQ Progress
 *     page exists — only the per-contract `/contracts/{id}/boq-progress`
 *     tab does. Omitted from the header actions.
 *   - Job Order on a contract picked from Recent Contracts or the default
 *     selection: the dashboard's own `recent` list (shared across 6
 *     modules' dashboards — contracts/factory-tasks/maintenance/
 *     production/safety/users all return the exact same shape) doesn't
 *     carry `jobOrder`, and widening that shared cross-module type for one
 *     display field here was judged out of proportion. Job Order shows
 *     "—" for those two paths and the real value once the manager searches
 *     for a contract (the search result DOES carry it, from
 *     contractsApi.list()'s richer Contract shape).
 */
export default async function ContractManagementExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    contractsApi.dashboard(),
    authApi.me(accessToken),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  const data: ContractDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const isManager = data?.dashboardType === 'MANAGER';
  const manager = data?.manager;

  // Real records, just reordered for display: cancelled contracts sort
  // after active/working ones (stable sort keeps each group's own recency
  // order) — never hidden, just not leading. Capped to 5 per this unit's
  // own "maximum 5 rows" requirement.
  const recentSorted = data
    ? [...data.recent].sort((a, b) => (a.status === 'CANCELLED' ? 1 : 0) - (b.status === 'CANCELLED' ? 1 : 0))
    : [];
  const recentContracts: RecentContractRow[] = recentSorted.slice(0, 5).map((c) => ({
    id: c.id, referenceNumber: c.referenceNumber, title: c.title, status: c.status, updatedAt: c.updatedAt,
  }));

  // One BOQ fetch per recent row (max 5) — bounded, parallel, read-only.
  // Reused by both the Recent Contracts table's "BOQ Progress" column and,
  // for whichever row is the default selection, the Selected Contract
  // Progress card below (no duplicate fetch for that one).
  const recentContractsBoqItems = await Promise.all(recentContracts.map((c) => fetchBoqConfirmations(c.id)));

  const defaultContractId = pickDefaultContractId(data?.recent ?? []);
  const defaultIndex = recentContracts.findIndex((c) => c.id === defaultContractId);
  const defaultContractRow = defaultIndex >= 0 ? recentContracts[defaultIndex] : undefined;
  const initialContract: SelectedContractBasics | null = defaultContractRow
    ? { id: defaultContractRow.id, referenceNumber: defaultContractRow.referenceNumber, title: defaultContractRow.title, status: defaultContractRow.status }
    : null;
  const initialBoqItems = defaultIndex >= 0 ? (recentContractsBoqItems[defaultIndex] ?? null) : null;

  const canCreateContract = permissions.includes('contracts.create');

  // KPI row — Total/Active/Pending Approvals use the exact same formula
  // PlatformDashboardService's own Contract Management card uses (see that
  // service's own doc comment); Open Claims and Needs Attention are new,
  // both already-computed real fields (manager.summary.openClaims,
  // manager.attentionItems.length — the same per-record list the old page
  // already had, just counted here instead of rendered as a chip row).
  const kpis: { label: string; value: number | null; icon: LucideIcon; tone?: 'warning' | 'error' | undefined }[] = [
    {
      label: 'Total Contracts',
      value: data
        ? data.metrics.totalDraft + data.metrics.totalActive + data.metrics.totalExpiring +
          data.metrics.totalExpired + data.metrics.totalTerminated + data.metrics.totalClosed + data.metrics.totalCancelled
        : null,
      icon: FileText,
    },
    { label: 'Active Contracts', value: data?.metrics.totalActive ?? null, icon: Activity },
    { label: 'Pending Approvals', value: data?.metrics.totalDraft ?? null, icon: ClipboardCheck },
    { label: 'Outstanding Payments', value: manager?.summary.outstandingPayments ?? null, icon: Wallet, tone: (manager?.summary.outstandingPayments ?? 0) > 0 ? 'warning' : undefined },
    { label: 'Open Claims', value: manager?.summary.openClaims ?? null, icon: Receipt, tone: (manager?.summary.openClaims ?? 0) > 0 ? 'warning' : undefined },
    { label: 'Needs Attention', value: manager?.attentionItems.length ?? null, icon: AlertTriangle, tone: (manager?.attentionItems.length ?? 0) > 0 ? 'error' : undefined },
  ];

  const attentionRows: DashboardAttentionRow[] = buildNeedsAttentionRows({
    pendingApprovals: data?.metrics.totalDraft ?? 0,
    overdueWorkflowTasks: manager?.summary.overdueWorkflowTasks ?? 0,
    openClaims: manager?.summary.openClaims ?? 0,
    outstandingPayments: manager?.summary.outstandingPayments ?? 0,
    boqItemsNeedingReview: manager?.boqOverview.itemsNeedingReview ?? 0,
    criticalContracts: manager?.insights.criticalProjectContracts ?? 0,
  });

  const todaysFocus = buildTodaysFocus({
    approvalsWaiting: data?.metrics.totalDraft ?? 0,
    paymentsPending: manager?.summary.outstandingPayments ?? 0,
    claimsToReview: manager?.summary.openClaims ?? 0,
    boqItemsNeedingReview: manager?.boqOverview.itemsNeedingReview ?? 0,
    contractsClosingSoon: manager?.insights.contractsClosingSoon ?? 0,
  });

  const boqOverview = manager?.boqOverview ?? null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-5 py-5 lg:px-8">
      <ExecutiveModuleNav code="CONTRACTS_MANAGEMENT" permissions={permissions} />

      {/* 1. Header — FMP-UI-35: brought in line with the other 4 piece-flow
          dashboards' own header card (bordered/shadowed, an icon beside the
          title, Refresh + Back to Platform Dashboard present) — this page
          previously had none of those 3, the one visible outlier among the
          5. Button order now matches the shared pattern too: primary
          action first, Refresh, Back to Platform Dashboard, secondary
          action last. No more large Quick Actions box (FMP-UI-16D's
          "Quick Actions" card and FMP-UI-07D's ExecutiveQuickLinks row are
          both still gone). */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">Contract Management</h1>
            <p className="mt-1 text-sm text-text-secondary">Track contracts, approvals, payments, projects, and BOQ progress.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/contracts"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
          >
            View Contract List
          </Link>
          <RefreshButton />
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            Back to Platform Dashboard
          </Link>
          {canCreateContract && (
            <Link
              href="/contracts/new"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              New Contract Register
            </Link>
          )}
        </div>
      </div>

      {!data && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      {/* 3. KPI row — 6 compact cards, one row on desktop. FMP-UI-35: now
          the shared DashboardKpiCard every piece-flow dashboard uses. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <DashboardKpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone ?? 'neutral'} />
        ))}
      </div>

      {/* Main layout — left ~65%: selector + selected progress + overall BOQ
          + recent contracts; right ~35%: needs attention + today's focus. */}
      <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
        <div className="space-y-4">
          {/* 2 & 7. Contract/Project selector, Selected Contract Progress, Recent Contracts. */}
          <ContractDashboardLeftColumn
            initialContract={initialContract}
            initialBoqItems={initialBoqItems}
            recentContracts={recentContracts}
            recentContractsBoqItems={recentContractsBoqItems}
          />

          {/* 5. Overall BOQ Piece Progress — summed across every contract this actor can see. */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Overall BOQ Piece Progress</h2>
            {!boqOverview || !boqOverview.hasAnyData ? (
              <div className="mt-2">
                <p className="text-sm text-text-muted">No BOQ piece progress yet.</p>
                <p className="mt-0.5 text-xs text-text-muted">Progress will appear after Technical confirms and generates pieces.</p>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[
                  ['Confirmed', boqOverview.confirmedPieces],
                  ['Generated', boqOverview.piecesGenerated],
                  ['Produced', boqOverview.produced],
                  ['Delivered', boqOverview.delivered],
                  ['Completed', boqOverview.completed],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{value}</p>
                    <p className="text-[11px] text-text-secondary">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* 6. Needs Attention — FMP-UI-35: now the shared
              DashboardNeedsAttentionPanel every piece-flow dashboard uses
              (collapses to the one required "No urgent items." message
              when every row is 0, instead of always showing all 6 rows). */}
          <section aria-labelledby="contracts-exec-attention-heading" className="space-y-2">
            <h2 id="contracts-exec-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Needs Attention
            </h2>
            {isManager ? (
              <DashboardNeedsAttentionPanel rows={attentionRows} />
            ) : (
              <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
                Not available for your current access level — open the full Contract Dashboard for your assigned tasks.
              </div>
            )}
          </section>

          {/* 8. Today's Focus. */}
          <section aria-labelledby="contracts-exec-focus-heading" className="space-y-2">
            <h2 id="contracts-exec-focus-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Today&rsquo;s Focus
            </h2>
            <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
              {todaysFocus.length === 0 ? (
                <p className="px-1 py-1 text-sm text-text-muted">No urgent items.</p>
              ) : (
                <ul className="space-y-1">
                  {todaysFocus.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        <span className="text-text-secondary">{item.label}</span>
                        <span className="font-semibold text-text-primary">{item.value}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
