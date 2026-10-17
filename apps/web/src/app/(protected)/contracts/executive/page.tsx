import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Activity, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { Contract, ContractDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { fetchProjectBoq } from '../_lib/dashboard-boq';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { DashboardKpiCard } from '../../_components/dashboard-kpi-card';
import { ProjectOverview } from './_components/project-overview';
import { buildProjectRow, isBoqInProgress, summarizeProgress, sumProgress } from './_lib/project-overview-helpers';
import type { ProjectRow } from './_lib/project-overview-helpers';

export const metadata: Metadata = { title: 'Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/** How many of the newest contracts the table loads up front (each one also loads its BOQ progress). */
const LOADED_CONTRACTS = 20;
// Needs Attention and BOQ In Progress are counted per contract from its BOQ, so they cover only the contracts loaded up front.
const SCOPE_HINT = `Among the ${LOADED_CONTRACTS} newest contracts`;

/**
 * FMP-UI-38 — Contract Management as a common Project / Contract Overview.
 * Many people besides Contract Management open this page (managers, Technical,
 * Production, Storage Yard & Delivery, Erection), so it answers five plain
 * questions: which contract am I looking for, what is its status, how far is
 * its BOQ / piece progress, does anything need attention, and where are the
 * details. Frontend only — it reads the contract list, the existing dashboard
 * figures and each contract's BOQ progress; no backend, schema, permission or
 * workflow logic changed. The page is still gated by `contracts.read`, and
 * Edit / Payments / Issues / Approve links appear only for users who already
 * hold the permission those screens need (see rowActions()).
 */
export default async function ContractManagementExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult, listResult] = await Promise.allSettled([
    contractsApi.dashboard(),
    authApi.me(accessToken),
    contractsApi.list({ pageSize: LOADED_CONTRACTS }),
  ]);

  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok ? meResult.value.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  const data: ContractDashboardData | null = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const manager = data?.manager;
  const contracts: Contract[] = listResult.status === 'fulfilled' ? listResult.value.items : [];

  // Cancelled contracts sort last (stable, so each group keeps its own order); never hidden.
  const ordered = [...contracts].sort((a, b) => (a.status === 'CANCELLED' ? 1 : 0) - (b.status === 'CANCELLED' ? 1 : 0));
  // One read-only BOQ fetch per contract, in parallel; a cancelled contract has nothing left to track.
  const boqItems = await Promise.all(ordered.map((c) => (c.status === 'CANCELLED' ? Promise.resolve(null) : fetchProjectBoq(c.id))));
  const rows: ProjectRow[] = ordered.map((c, i) =>
    buildProjectRow({
      id: c.id,
      referenceNumber: c.referenceNumber,
      title: c.title,
      status: c.status,
      client: c.firstParty?.name ?? c.counterpartyName,
      jobOrder: c.jobOrder ?? null,
      openClaims: c.openClaimsCount ?? 0,
      progress: summarizeProgress(boqItems[i] ?? null),
    }),
  );

  const canCreateContract = permissions.includes('contracts.create');

  // Overall BOQ Progress: the dashboard's all-contracts totals when available, otherwise the sum of the contracts listed above.
  const overall = manager?.boqOverview.hasAnyData
    ? {
        confirmed: manager.boqOverview.confirmedPieces,
        generated: manager.boqOverview.piecesGenerated,
        produced: manager.boqOverview.produced,
        delivered: manager.boqOverview.delivered,
        erected: manager.boqOverview.erected,
        completed: manager.boqOverview.completed,
        note: null as string | null,
      }
    : (() => {
        const sum = sumProgress(rows);
        return {
          confirmed: sum.confirmed,
          generated: sum.generated,
          produced: sum.produced,
          delivered: sum.delivered,
          erected: sum.erected,
          completed: sum.completed,
          note: rows.length > 0 ? `Based on the ${LOADED_CONTRACTS} newest contracts only.` : null,
        };
      })();
  const hasOverall = overall.confirmed + overall.generated + overall.produced + overall.delivered + overall.erected + overall.completed > 0;

  const needsAttentionCount = rows.filter((r) => r.reasons.some((x) => x.kind === 'attention')).length;
  const boqInProgressCount = rows.filter(isBoqInProgress).length;

  // Overall BOQ Element Progress: only the totals the dashboard data supports (no Released / In Production / In Storage — those exist per project only).
  const overallTiles = hasOverall
    ? [
        { label: 'Confirmed', value: overall.confirmed },
        { label: 'Generated', value: overall.generated },
        { label: 'Produced', value: overall.produced },
        { label: 'Delivered', value: overall.delivered },
        { label: 'Erected', value: overall.erected },
        { label: 'Completed', value: overall.completed },
      ]
    : null;
  const totalContracts = listResult.status === 'fulfilled' ? listResult.value.total : contracts.length;

  return (
    // FMP-UI-49 — on desktop the page is exactly as tall as <main>: the projects list absorbs the leftover height and scrolls
    // inside its own panel. Below lg (or on a very short window) it simply scrolls as one page.
    <div className="flex w-full flex-col gap-2 px-4 py-2 lg:h-full lg:px-6">
      <div className="shrink-0"><ExecutiveModuleNav code="CONTRACTS_MANAGEMENT" permissions={permissions} /></div>

      {/* Header — only the two actions people actually need here. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary lg:text-2xl">Contract Management</h1>
            <p className="text-sm text-text-secondary">View contracts, BOQ element progress, project status and pending attention.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/contracts"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
          >
            View Contract List
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

      {!data && contracts.length === 0 && (
        <div className="shrink-0 rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Contract information is not available right now. Please try again shortly.
        </div>
      )}

      {/* Four simple summary cards. */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardKpiCard compact label="Active Contracts" value={data?.metrics.totalActive ?? null} icon={Activity} />
        <DashboardKpiCard
          compact
          label="Needs Attention"
          value={contracts.length > 0 || data ? needsAttentionCount : null}
          icon={AlertTriangle}
          tone={needsAttentionCount > 0 ? 'warning' : 'neutral'}
          hint={SCOPE_HINT}
        />
        <DashboardKpiCard compact label="BOQ In Progress" value={contracts.length > 0 || data ? boqInProgressCount : null} icon={Layers} hint={SCOPE_HINT} />
        <DashboardKpiCard compact label="Completed / Closed" value={data?.metrics.totalClosed ?? null} icon={CheckCircle2} />
      </div>

      {/* Search and filters, Needs Attention, the projects table, then Selected Project Progress beside Overall BOQ Element Progress. */}
      <ProjectOverview
        rows={rows}
        paymentsPending={manager?.summary.outstandingPayments ?? null}
        overallTiles={overallTiles}
        overallNote={overall.note}
        totalContracts={totalContracts}
      />
    </div>
  );
}
