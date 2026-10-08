import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Package, Factory, Boxes, PauseCircle, XCircle, AlertTriangle } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { productionPiecesApi } from '@/lib/production-pieces-api';
import type { ProductionContractProgress } from '@/lib/production-pieces-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { RefreshButton } from '../../technical/_components/refresh-button';
import { BOQ_PIECE_STATUS_LABELS, BOQ_PIECE_STATUS_CLASSES } from '../../technical/_lib/boq-confirmation-helpers';
import { ProductionContractSelector } from './_components/production-contract-selector';
import { DashboardKpiCard } from '../../_components/dashboard-kpi-card';
import { DashboardNeedsAttentionPanel } from '../../_components/dashboard-needs-attention-panel';
import {
  pickDefaultProductionContract,
  buildOverallProductionFlow,
  buildProductionKpis,
  buildProductionNeedsAttentionRows,
  buildProductionWorkQueue,
} from './_lib/production-dashboard-helpers';

export const metadata: Metadata = { title: 'Production & Planning — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — original Executive Module Landing Page for Production
 * Planning: reused `/production/dashboard`'s own order-based metrics
 * (Scheduled/In Progress/Paused/Completed This Month), a permanently
 * `available={false}` Needs Attention ("Production & Planning does not yet
 * track a delayed or at-risk order state"), a recent-ORDERS table, and
 * generic Quick Links (Scheduled/In Progress/Paused).
 *
 * FMP-UI-32 — full redesign: the real flow this module actually runs on
 * today is "Technical generates pieces → Production moves Drawing Ready
 * pieces through In Production → Produced," and none of that piece data
 * was visible anywhere on this page. Every section below instead reads
 * `ProductionPiecesService.contractProgress()` — ONE read-only, per-contract
 * piece-status query, added to the EXISTING Piece Production screen's own
 * backend service (no new module, no Technical/BOQ file touched) — plus a
 * second new read-only query, `recentUpdates()`, for the latest real status
 * changes. No production order/batch/inventory concept was added; the old
 * order-based `/production/dashboard` page is untouched at its own route,
 * and `productionApi`/`ProductionDashboardData` (order metrics) are no
 * longer imported here at all.
 */
export default async function ProductionExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [meResult, contractsResult, recentResult] = await Promise.allSettled([
    authApi.me(accessToken),
    productionPiecesApi.contractProgress(),
    productionPiecesApi.recentUpdates(),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('production.read')) notFound();

  const contracts: ProductionContractProgress[] =
    (contractsResult.status === 'fulfilled' ? contractsResult.value : null) ?? [];
  const hasData = contractsResult.status === 'fulfilled' && contractsResult.value !== null;
  const recentUpdates = (recentResult.status === 'fulfilled' ? recentResult.value : null) ?? [];

  const defaultContract = pickDefaultProductionContract(contracts);
  const flow = buildOverallProductionFlow(contracts);
  const kpis = buildProductionKpis(contracts);
  const attentionRows = buildProductionNeedsAttentionRows(contracts);
  const workQueue = buildProductionWorkQueue(contracts, 5);

  const kpiCards = [
    { label: 'Ready for Production', value: kpis.ready, icon: Package, tone: 'neutral' as const },
    { label: 'In Production', value: kpis.inProduction, icon: Factory, tone: 'neutral' as const },
    { label: 'Produced', value: kpis.produced, icon: Boxes, tone: 'success' as const },
    { label: 'On Hold', value: kpis.onHold, icon: PauseCircle, tone: kpis.onHold > 0 ? ('warning' as const) : ('neutral' as const) },
    { label: 'Rejected', value: kpis.rejected, icon: XCircle, tone: kpis.rejected > 0 ? ('error' as const) : ('neutral' as const) },
    { label: 'Needs Attention', value: kpis.needsAttention, icon: AlertTriangle, tone: kpis.needsAttention > 0 ? ('error' as const) : ('neutral' as const) },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5 lg:px-8">
      <ExecutiveModuleNav code="PRODUCTION_DASHBOARD" permissions={permissions} />

      {/* Header — FMP-UI-35: added the plain icon the other 4 piece-flow
          dashboards' headers now carry (was the one of the 3 "newer"
          dashboards with no icon at all). */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Factory className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">Production & Planning</h1>
            <p className="mt-1 text-sm text-text-secondary">Track ready pieces, in-production pieces, and produced pieces.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/production/pieces"
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
          >
            Open Piece Production
          </Link>
          <RefreshButton />
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            Back to Platform Dashboard
          </Link>
          {/* FMP-UI-32 — "View Production Orders" kept as a secondary action
              only (was the page's single large primary button, FMP-UI-07);
              "Scheduled/In Progress/Paused" quick links removed entirely —
              this unit's own "do not show unless those pages actually help"
              instruction, now that piece data is the page's real focus. */}
          <Link href="/production" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            View Production Orders
          </Link>
          <Link href="/contracts" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            View Contract List
          </Link>
        </div>
      </div>

      {!hasData && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}

      {/* KPI row — FMP-UI-35: now the shared DashboardKpiCard. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi) => (
          <DashboardKpiCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
        <div className="space-y-4">
          {/* Contract/Project selector + Selected Project Production */}
          <ProductionContractSelector contracts={contracts} defaultContractId={defaultContract?.contractId ?? null} />

          {/* Overall Production Flow */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Overall Production Flow</h2>
            {contracts.length === 0 ? (
              <div className="mt-2">
                <p className="text-sm text-text-muted">No pieces ready for production yet.</p>
                <p className="mt-0.5 text-xs text-text-muted">Pieces will appear after Technical generates drawing-confirmed pieces.</p>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-sm">
                <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                  <p className="text-lg font-bold text-text-primary">{flow.ready}</p>
                  <p className="text-[11px] text-text-secondary">Ready</p>
                </div>
                <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                  <p className="text-lg font-bold text-text-primary">{flow.inProduction}</p>
                  <p className="text-[11px] text-text-secondary">In Production</p>
                </div>
                <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                  <p className="text-lg font-bold text-text-primary">{flow.produced}</p>
                  <p className="text-[11px] text-text-secondary">Produced</p>
                </div>
              </div>
            )}
          </div>

          {/* Production Work Queue — max 5, per this unit's own requirement. */}
          <section aria-labelledby="production-queue-heading" className="space-y-2">
            <h2 id="production-queue-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Production Work Queue
            </h2>
            {workQueue.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
                No contracts have pieces to produce yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary">
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Contract / Job Order</th>
                      <th className="hidden px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary sm:table-cell">Project</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Ready</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">In Prod.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Produced</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Hold/Rej.</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {workQueue.map((c) => (
                      <tr key={c.contractId} className="hover:bg-surface-secondary/60">
                        <td className="px-3 py-2">
                          <p className="font-mono text-xs text-text-muted">{c.jobOrder ?? c.referenceNumber}</p>
                          <p className="text-xs text-text-secondary sm:hidden">{c.projectName}</p>
                        </td>
                        <td className="hidden px-3 py-2 text-text-secondary sm:table-cell">{c.projectName}</td>
                        <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.readyForProduction}</td>
                        <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.inProduction}</td>
                        <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.produced}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${c.onHold + c.rejected > 0 ? 'text-warning' : 'text-text-muted'}`}>
                          {c.onHold + c.rejected}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/production/pieces?contractId=${c.contractId}`} className="text-xs font-semibold text-accent hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {/* Needs Attention */}
          <section aria-labelledby="production-attention-heading" className="space-y-2">
            <h2 id="production-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Needs Attention
            </h2>
            <DashboardNeedsAttentionPanel rows={attentionRows} />
          </section>

          {/* Recent Production Updates — max 5, real piece status history. */}
          <section aria-labelledby="production-recent-heading" className="space-y-2">
            <h2 id="production-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Recent Production Updates
            </h2>
            {recentUpdates.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-text-muted">
                No recent piece status updates.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {recentUpdates.map((u) => (
                  <li key={u.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">{u.pieceCode}</p>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${BOQ_PIECE_STATUS_CLASSES[u.newStatus]}`}>
                        {BOQ_PIECE_STATUS_LABELS[u.newStatus]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">{u.jobOrder ?? u.referenceNumber} · {u.projectName}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {u.createdAt.slice(0, 16).replace('T', ' ')}{u.updatedByName ? ` · ${u.updatedByName}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
