import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Boxes, Warehouse, Truck, PauseCircle, XCircle, AlertTriangle } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { storageDeliveryPiecesApi } from '@/lib/storage-delivery-pieces-api';
import type { StorageContractProgress } from '@/lib/storage-delivery-pieces-api';
import { isExecutiveManagerOrAdminAccess } from '../../_lib/module-visibility';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { RefreshButton } from '../../technical/_components/refresh-button';
import { BOQ_PIECE_STATUS_LABELS, BOQ_PIECE_STATUS_CLASSES } from '../../technical/_lib/boq-confirmation-helpers';
import { DashboardKpiCard } from '../../_components/dashboard-kpi-card';
import { DashboardNeedsAttentionPanel } from '../../_components/dashboard-needs-attention-panel';
import { StorageContractSelector } from './_components/storage-contract-selector';
import {
  pickDefaultStorageContract,
  buildOverallDeliveryFlow,
  buildStorageKpis,
  buildStorageNeedsAttentionRows,
  buildDeliveryWorkQueue,
} from './_lib/storage-dashboard-helpers';

export const metadata: Metadata = { title: 'Storage Yard & Delivery — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-10 — original Executive Module Landing Page: no real backend
 * existed yet, so it was deliberately just nav + title + an honest
 * `ExecutiveComingSoon` "module will be configured in a future unit"
 * message, plus a single "Piece Delivery" link shown only to actors with
 * `storage_delivery.read`.
 *
 * FMP-UI-33 — full redesign: Piece Delivery (FMP-BOQ-08) now exists and the
 * real BOQ piece flow (Technical → Drawing Ready, Production → Produced,
 * Storage Yard & Delivery → In Store/Delivered) reaches this module, so the
 * placeholder is no longer true. Every real-data section below reads
 * `StorageDeliveryPiecesService.contractProgress()`/`recentUpdates()` — two
 * new read-only queries added to the Piece Delivery screen's OWN existing
 * service (no new module, no Technical/Production/Erection file touched).
 * Page-level access is unchanged (`isExecutiveManagerOrAdminAccess`, the
 * same gate `PlatformDashboardService`'s own card already uses — no
 * dedicated module permission exists); the real-data sections additionally
 * check `storage_delivery.read` (the same conditional the old page's
 * "Piece Delivery" link already used), so an Executive Manager/Admin
 * without that specific permission still sees the page, just with an
 * honest "not available" in place of piece data — never fabricated.
 */
export default async function StorageDeliveryExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];
  if (!isExecutiveManagerOrAdminAccess(permissions)) notFound();

  const canReadPieces = permissions.includes('storage_delivery.read');
  const [contractsResult, recentResult] = canReadPieces
    ? await Promise.allSettled([storageDeliveryPiecesApi.contractProgress(), storageDeliveryPiecesApi.recentUpdates()])
    : [{ status: 'fulfilled' as const, value: null }, { status: 'fulfilled' as const, value: null }];

  const contracts: StorageContractProgress[] =
    (contractsResult.status === 'fulfilled' ? contractsResult.value : null) ?? [];
  const hasData = canReadPieces && contractsResult.status === 'fulfilled' && contractsResult.value !== null;
  const recentUpdates = (recentResult.status === 'fulfilled' ? recentResult.value : null) ?? [];

  const defaultContract = pickDefaultStorageContract(contracts);
  const flow = buildOverallDeliveryFlow(contracts);
  const kpis = buildStorageKpis(contracts);
  const attentionRows = buildStorageNeedsAttentionRows(contracts);
  const workQueue = buildDeliveryWorkQueue(contracts, 5);

  const kpiCards = [
    { label: 'Ready for Store', value: kpis.readyForStore, icon: Boxes, tone: 'neutral' as const },
    { label: 'In Store', value: kpis.inStore, icon: Warehouse, tone: 'neutral' as const },
    { label: 'Delivered', value: kpis.delivered, icon: Truck, tone: 'success' as const },
    { label: 'On Hold', value: kpis.onHold, icon: PauseCircle, tone: kpis.onHold > 0 ? ('warning' as const) : ('neutral' as const) },
    { label: 'Rejected', value: kpis.rejected, icon: XCircle, tone: kpis.rejected > 0 ? ('error' as const) : ('neutral' as const) },
    { label: 'Needs Attention', value: kpis.needsAttention, icon: AlertTriangle, tone: kpis.needsAttention > 0 ? ('error' as const) : ('neutral' as const) },
  ];
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5 lg:px-8">
      <ExecutiveModuleNav code="STORAGE_DELIVERY" permissions={permissions} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Warehouse className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">Storage Yard & Delivery</h1>
            <p className="mt-1 text-sm text-text-secondary">Track produced pieces, storage status, and delivery progress.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {canReadPieces && (
            <Link
              href="/storage-delivery/pieces"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              Open Piece Delivery
            </Link>
          )}
          <RefreshButton />
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            Back to Platform Dashboard
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
        <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
          Not available for your current access level — ask a Storage Yard & Delivery user for piece status.
        </div>
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
            {/* Contract/Project selector + Selected Project Delivery */}
            <StorageContractSelector contracts={contracts} defaultContractId={defaultContract?.contractId ?? null} />

            {/* Overall Delivery Flow */}
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Overall Delivery Flow</h2>
              {contracts.length === 0 ? (
                <div className="mt-2">
                  <p className="text-sm text-text-muted">No pieces ready for storage or delivery yet.</p>
                  <p className="mt-0.5 text-xs text-text-muted">Pieces will appear after Production marks them as Produced.</p>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-sm">
                  <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{flow.readyForStore}</p>
                    <p className="text-[11px] text-text-secondary">Ready for Store</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{flow.inStore}</p>
                    <p className="text-[11px] text-text-secondary">In Store</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-2 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{flow.delivered}</p>
                    <p className="text-[11px] text-text-secondary">Delivered</p>
                  </div>
                </div>
              )}
            </div>

            {/* Delivery Work Queue — max 5. */}
            <section aria-labelledby="storage-queue-heading" className="space-y-2">
              <h2 id="storage-queue-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Delivery Work Queue
              </h2>
              {workQueue.length === 0 ? (
                <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
                  No contracts have pieces to store or deliver yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary">
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">Contract / Job Order</th>
                        <th className="hidden px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary sm:table-cell">Project</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Ready</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">In Store</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-secondary">Delivered</th>
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
                          <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.readyForStore}</td>
                          <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.inStore}</td>
                          <td className="px-3 py-2 text-right font-semibold text-text-primary">{c.delivered}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${c.onHold + c.rejected > 0 ? 'text-warning' : 'text-text-muted'}`}>
                            {c.onHold + c.rejected}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link href={`/storage-delivery/pieces?contractId=${c.contractId}`} className="text-xs font-semibold text-accent hover:underline">
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
            <section aria-labelledby="storage-attention-heading" className="space-y-2">
              <h2 id="storage-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Needs Attention
              </h2>
              <DashboardNeedsAttentionPanel rows={attentionRows} />
            </section>

            {/* Recent Storage / Delivery Updates — max 5. */}
            <section aria-labelledby="storage-recent-heading" className="space-y-2">
              <h2 id="storage-recent-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Recent Storage / Delivery Updates
              </h2>
              {recentUpdates.length === 0 ? (
                <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-text-muted">
                  No recent storage or delivery updates.
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
          </div>
        </div>
      )}
    </div>
  );
}
