import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Activity, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';
import { contractsApi } from '@/lib/contracts-api';
import type { Contract, ContractDashboardData } from '@/lib/contracts-api';
import { authApi } from '@/lib/auth-api';
import { fetchBoqConfirmations } from '@/lib/technical-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { DashboardKpiCard } from '../../_components/dashboard-kpi-card';
import { ProjectOverview } from './_components/project-overview';
import { buildProjectRow, isBoqInProgress, summarizeProgress, sumProgress } from './_lib/project-overview-helpers';
import type { ProjectRow } from './_lib/project-overview-helpers';

export const metadata: Metadata = { title: 'Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/** How many of the newest contracts the table loads up front (each one also loads its BOQ progress). */
const LOADED_CONTRACTS = 20;
const SCOPE_HINT = `Newest ${LOADED_CONTRACTS} contracts`;

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
  const boqItems = await Promise.all(ordered.map((c) => (c.status === 'CANCELLED' ? Promise.resolve(null) : fetchBoqConfirmations(c.id))));
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
          note: rows.length > 0 ? `Based on the ${SCOPE_HINT.toLowerCase()}.` : null,
        };
      })();
  const hasOverall = overall.confirmed + overall.generated + overall.produced + overall.delivered + overall.erected + overall.completed > 0;

  const needsAttentionCount = rows.filter((r) => r.reasons.some((x) => x.kind === 'attention')).length;
  const boqInProgressCount = rows.filter(isBoqInProgress).length;

  // Compact: six numbers in two rows of three, beside the Selected Contract card (not stretched across the page).
  const overallCard = (
    <section aria-labelledby="overall-boq-heading" className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 id="overall-boq-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Overall BOQ Progress</h2>
      {!hasOverall ? (
        <div className="mt-2">
          <p className="text-sm text-text-muted">No BOQ piece progress yet.</p>
          <p className="mt-0.5 text-xs text-text-muted">Progress will appear after Technical confirms and generates pieces.</p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['Confirmed', overall.confirmed],
              ['Generated', overall.generated],
              ['Produced', overall.produced],
              ['Delivered', overall.delivered],
              ['Erected', overall.erected],
              ['Completed', overall.completed],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg bg-surface-secondary px-2 py-2.5 text-center">
                <p className="text-xl font-bold text-text-primary">{value}</p>
                <p className="text-[11px] text-text-secondary">{label}</p>
              </div>
            ))}
          </div>
          {overall.note && <p className="mt-2 text-xs text-text-muted">{overall.note}</p>}
        </>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-6">
      <ExecutiveModuleNav code="CONTRACTS_MANAGEMENT" permissions={permissions} />

      {/* Header — only the two actions people actually need here. */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary lg:text-3xl">Contract Management</h1>
            <p className="mt-1 text-sm text-text-secondary">View contracts, project status, BOQ progress, and pending attention.</p>
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
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Contract information is not available right now. Please try again shortly.
        </div>
      )}

      {/* Four simple summary cards. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardKpiCard label="Active Contracts" value={data?.metrics.totalActive ?? null} icon={Activity} />
        <DashboardKpiCard
          label="Needs Attention"
          value={contracts.length > 0 || data ? needsAttentionCount : null}
          icon={AlertTriangle}
          tone={needsAttentionCount > 0 ? 'warning' : 'neutral'}
          hint={SCOPE_HINT}
        />
        <DashboardKpiCard label="BOQ In Progress" value={contracts.length > 0 || data ? boqInProgressCount : null} icon={Layers} hint={SCOPE_HINT} />
        <DashboardKpiCard label="Completed / Closed" value={data?.metrics.totalClosed ?? null} icon={CheckCircle2} />
      </div>

      {/* Search and filters, then the table beside Needs Attention, then Selected Contract beside Overall BOQ Progress. */}
      <ProjectOverview
        rows={rows}
        permissions={permissions}
        paymentsPending={manager?.summary.outstandingPayments ?? null}
        overall={overallCard}
      />
    </div>
  );
}
