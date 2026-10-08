import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HardHat, CheckCircle2, PauseCircle, XCircle, AlertTriangle } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { contractsApi } from '@/lib/contracts-api';
import type { ErectionDashboardData } from '@/lib/contracts-api';
import { erectionPiecesApi } from '@/lib/erection-pieces-api';
import type { ErectionContractProgress } from '@/lib/erection-pieces-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { RefreshButton } from '../../technical/_components/refresh-button';
import { BOQ_PIECE_STATUS_LABELS, BOQ_PIECE_STATUS_CLASSES } from '../../technical/_lib/boq-confirmation-helpers';
import { DashboardKpiCard } from '../../_components/dashboard-kpi-card';
import { DashboardNeedsAttentionPanel } from '../../_components/dashboard-needs-attention-panel';
import { ErectionContractSelector } from './_components/erection-contract-selector';
import { ErectionWorkflowSummaryCard } from './_components/erection-workflow-summary-card';
import {
  pickDefaultErectionContract,
  buildOverallErectionFlow,
  buildErectionKpis,
  buildErectionNeedsAttentionRows,
  buildErectionWorkQueue,
} from './_lib/erection-dashboard-helpers';

export const metadata: Metadata = { title: 'Erection Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 → FMP-UI-19B/19D — original Executive Module Landing Page: the
 * shared `ErectionWorkflowStatusDashboard` component (the same one the full
 * `/contracts/erection-dashboard` page uses) as this page's entire body,
 * plus a small "Piece Erection" link above it.
 *
 * FMP-UI-34 — the real flow this module runs on today is BOQ pieces
 * (Technical → Drawing Ready, Production → Produced, Storage Yard &
 * Delivery → Delivered, Erection → Erected/Completed), and none of that
 * piece data was visible here — the page was still 100% about the OLDER
 * method-statement/checklist workflow. Every real-data section below
 * reads `ErectionPiecesService.contractProgress()`/`recentUpdates()` — two
 * new read-only queries added to the Piece Erection screen's OWN existing
 * service (mirroring FMP-UI-32/33 exactly; no Technical/Production/Storage
 * file touched). The OLD workflow is NOT removed: `ErectionWorkflowStatusDashboard`
 * is gone from this page, but its own route (`/contracts/erection-dashboard`)
 * is completely untouched, and `ErectionWorkflowSummaryCard` (3 real
 * figures from the SAME `contractsApi.erectionDashboard()` call this page
 * already made) keeps it one click away. Page-level access is unchanged
 * (`contracts.read`); piece sections additionally check `erection.read`
 * (the same conditional the old page's own "Piece Erection" link already
 * used).
 */
export default async function ErectionExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [meResult, workflowResult] = await Promise.allSettled([
    authApi.me(accessToken),
    contractsApi.erectionDashboard(),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  const workflowData: ErectionDashboardData | null = workflowResult.status === 'fulfilled' ? workflowResult.value : null;

  const canReadPieces = permissions.includes('erection.read');
  const [contractsResult, recentResult] = canReadPieces
    ? await Promise.allSettled([erectionPiecesApi.contractProgress(), erectionPiecesApi.recentUpdates()])
    : [{ status: 'fulfilled' as const, value: null }, { status: 'fulfilled' as const, value: null }];

  const contracts: ErectionContractProgress[] =
    (contractsResult.status === 'fulfilled' ? contractsResult.value : null) ?? [];
  const hasData = canReadPieces && contractsResult.status === 'fulfilled' && contractsResult.value !== null;
  const recentUpdates = (recentResult.status === 'fulfilled' ? recentResult.value : null) ?? [];

  const defaultContract = pickDefaultErectionContract(contracts);
  const flow = buildOverallErectionFlow(contracts);
  const kpis = buildErectionKpis(contracts);
  const attentionRows = buildErectionNeedsAttentionRows(contracts);
  const workQueue = buildErectionWorkQueue(contracts, 5);

  const kpiCards = [
    { label: 'Ready for Erection', value: kpis.readyForErection, icon: HardHat, tone: 'neutral' as const },
    { label: 'Erected', value: kpis.erected, icon: HardHat, tone: 'neutral' as const },
    { label: 'Completed', value: kpis.completed, icon: CheckCircle2, tone: 'success' as const },
    { label: 'On Hold', value: kpis.onHold, icon: PauseCircle, tone: kpis.onHold > 0 ? ('warning' as const) : ('neutral' as const) },
    { label: 'Rejected', value: kpis.rejected, icon: XCircle, tone: kpis.rejected > 0 ? ('error' as const) : ('neutral' as const) },
    { label: 'Needs Attention', value: kpis.needsAttention, icon: AlertTriangle, tone: kpis.needsAttention > 0 ? ('error' as const) : ('neutral' as const) },
  ];
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5 lg:px-8">
      <ExecutiveModuleNav code="ERECTION" permissions={permissions} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <HardHat className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">Erection Dashboard</h1>
            <p className="mt-1 text-sm text-text-secondary">Track delivered pieces, erection progress, and completion status.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {canReadPieces && (
            <Link
              href="/erection/pieces"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              Open Piece Erection
            </Link>
          )}
          <RefreshButton />
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            Back to Platform Dashboard
          </Link>
          {/* FMP-UI-34 — old workflow kept as a SECONDARY action only, per
              this unit's own "do not make old workflow the main focus"
              instruction — not removed, just no longer the page's body. */}
          <Link href="/contracts/erection-dashboard" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            View Erection Workflow
          </Link>
          <Link href="/contracts" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            View Contract List
          </Link>
        </div>
      </div>

      {canReadPieces && !hasData && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline — please try again shortly.
        </div>
      )}
      {!canReadPieces && (
        <>
          <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
            Not available for your current access level — ask an Erection user for piece status.
          </div>
          {/* FMP-UI-34 — the old workflow summary is gated on contracts.read
              (the page's own access check), not erection.read, so it stays
              visible here too — "Old Erection Workflow remains accessible"
              must not depend on the BOQ-piece permission. */}
          <div className="max-w-sm">
            <ErectionWorkflowSummaryCard kpis={workflowData?.kpis} />
          </div>
        </>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi) => (
          <DashboardKpiCard
            key={kpi.label}
            label={kpi.label}
            value={canReadPieces ? kpi.value : null}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        ))}
      </div>

      {canReadPieces && (
        <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
          <div className="space-y-4">
            {/* Contract/Project selector + Selected Project Erection */}
            <ErectionContractSelector contracts={contracts} defaultContractId={defaultContract?.contractId ?? null} />

            {/* Overall Erection Flow */}
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Overall Erection Flow</h2>
              {contracts.length === 0 ? (
                <div className="mt-2">
                  <p className="text-sm text-text-muted">No pieces ready for erection yet.</p>
                  <p className="mt-0.5 text-xs text-text-muted">Pieces will appear after Storage Yard & Delivery marks them as Delivered.</p>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-sm">
                  <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{flow.readyForErection}</p>
                    <p className="text-[11px] text-text-secondary">Ready for Erection</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{flow.erected}</p>
                    <p className="text-[11px] text-text-secondary">Erected</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{flow.completed}</p>
                    <p className="text-[11px] text-text-secondary">Completed</p>
                  </div>
                </div>
              )}
            </div>

            {/* Erection Work Queue — max 5. */}
            <section aria-labelledby="erection-queue-heading" className="space-y-2">
              <h2 id="erection-queue-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Erection Work Queue
              </h2>
              {workQueue.length === 0 ? (
                <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
                  No contracts have pieces to erect yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary">
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Contract / Job Order</th>
                        <th className="hidden px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary sm:table-cell">Project</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Ready</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Erected</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Completed</th>
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
                          <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.readyForErection}</td>
                          <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.erected}</td>
                          <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.completed}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${c.onHold + c.rejected > 0 ? 'text-warning' : 'text-text-muted'}`}>
                            {c.onHold + c.rejected}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link href={`/erection/pieces?contractId=${c.contractId}`} className="text-xs font-semibold text-accent hover:underline">
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
            <section aria-labelledby="erection-attention-heading" className="space-y-2">
              <h2 id="erection-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Needs Attention
              </h2>
              <DashboardNeedsAttentionPanel rows={attentionRows} />
            </section>

            {/* Recent Erection Updates — max 5. */}
            <section aria-labelledby="erection-recent-heading" className="space-y-2">
              <h2 id="erection-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Recent Erection Updates
              </h2>
              {recentUpdates.length === 0 ? (
                <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-text-muted">
                  No recent erection updates.
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
                        {u.createdAt.slice(0, 16).replace('T', ' ')}
                        {u.currentLocation ? ` · ${u.currentLocation}` : ''}
                        {u.updatedByName ? ` · ${u.updatedByName}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Erection Workflow — small summary, old workflow kept accessible but not dominant. */}
            <ErectionWorkflowSummaryCard kpis={workflowData?.kpis} />
          </div>
        </div>
      )}
    </div>
  );
}
