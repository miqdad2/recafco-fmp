import Link from 'next/link';
import type { Metadata } from 'next';
import { Download, LayoutDashboard } from 'lucide-react';
import { DashboardScopeBadge } from '../_components/dashboard-scope-badge';
import { ContractSummaryCards } from './_components/contract-summary-cards';
import { ContractFilterBar } from './_components/contract-filter-bar';
import { ContractListTable } from './_components/contract-list-table';
import { contractsApi } from '../../../lib/contracts-api';
import { getUserPermissions } from './_lib/get-user-permissions';
import { fetchBoqConfirmations } from '@/lib/technical-api';
import { summarizeProgress } from './executive/_lib/project-overview-helpers';
import type { ProjectProgress } from './executive/_lib/project-overview-helpers';
import { countNeedingAttention, isDateWindowFilter, matchesDueWindow, statusApiValue } from './_lib/contract-list-view-helpers';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Contract List — RECAFCO FMP' };

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function ContractsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('contracts.create');

  // CM-55 — approved-design manager-facing filters. `lifecycleStatus` has no
  // corresponding field in the new filter bar (the approved design shows
  // only one "Contract Status" dropdown, driven by the manager-facing
  // schedule status below) but is still read/passed through here — the
  // Contract Manager Dashboard (CM-54) and the root dashboard both deep-link
  // to `/contracts?lifecycleStatus=ACTIVE`, and that must keep working.
  const lifecycleFilter = typeof params['lifecycleStatus'] === 'string' ? params['lifecycleStatus'] : undefined;
  const scheduleStatusFilter = typeof params['scheduleStatus'] === 'string' ? params['scheduleStatus'] : undefined;
  const contractTypeFilter = typeof params['contractType'] === 'string' ? params['contractType'] : undefined;
  const daysRemainingFilter = typeof params['daysRemaining'] === 'string' ? params['daysRemaining'] : undefined;
  // FMP-UI-41 — the Status choice (Draft / Active / Pending Approval / Closed / Cancelled) is the API's own `status` filter.
  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const ownerFilter = typeof params['ownerUserId'] === 'string' ? params['ownerUserId'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  const hasActiveFilters = Boolean(
    lifecycleFilter ?? statusFilter ?? scheduleStatusFilter ?? contractTypeFilter ?? daysRemainingFilter ?? ownerFilter ?? search,
  );

  // CM-69I — the exact same filter scope passed to both list() (the table)
  // and summary() (the KPI cards), so the two can never disagree about what
  // "currently visible" means — no separate global/filter-blind KPI query.
  // Status wins over View when both are chosen (the API reads lifecycleStatus first, so View is left out then).
  // "This Month" and "Next 3 Months" have no API filter: those load up to 100 contracts and are cut by due date
  // below; "Due Soon" / "Overdue" use the API's own filters.
  const statusApi = statusApiValue(statusFilter);
  const dateWindow = isDateWindowFilter(daysRemainingFilter) ? daysRemainingFilter : undefined;
  const filterParams = {
    ...(statusApi ? { status: statusApi } : lifecycleFilter ? { lifecycleStatus: lifecycleFilter } : {}),
    ...(scheduleStatusFilter ? { scheduleStatus: scheduleStatusFilter } : {}),
    ...(contractTypeFilter ? { contractType: contractTypeFilter } : {}),
    ...(daysRemainingFilter && !dateWindow ? { daysRemaining: daysRemainingFilter } : {}),
    ...(ownerFilter ? { ownerUserId: ownerFilter } : {}),
    ...(search ? { search } : {}),
  };

  const [listRes, summaryRes, dashboardRes] = await Promise.allSettled([
    contractsApi.list(dateWindow ? { page: 1, pageSize: 100, ...filterParams } : { page, pageSize: PAGE_SIZE, ...filterParams }),
    contractsApi.summary(filterParams),
    contractsApi.dashboard(),
  ]);

  let error: string | null = null;
  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  if (listRes.status === 'rejected') {
    error = listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load contracts';
  }

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
  const scope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;
  let contracts = result?.items ?? [];
  let total = result?.total ?? 0;
  let totalPages = result?.totalPages ?? 1;
  if (dateWindow) {
    const inWindow = contracts.filter((c) => matchesDueWindow(c, dateWindow));
    total = inWindow.length;
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    contracts = inWindow.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }

  // FMP-UI-40 — one read-only BOQ progress fetch per contract on this page (max 25, in parallel).
  // A cancelled contract has nothing left to track.
  const boqResults = await Promise.all(contracts.map((c) => (c.status === 'CANCELLED' ? Promise.resolve(null) : fetchBoqConfirmations(c.id))));
  const boqProgress: Record<string, ProjectProgress | null> = {};
  contracts.forEach((c, i) => {
    boqProgress[c.id] = summarizeProgress(boqResults[i] ?? null);
  });
  const needsAttention = countNeedingAttention(contracts);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged = {
      lifecycleStatus: lifecycleFilter,
      status: statusFilter,
      scheduleStatus: scheduleStatusFilter,
      contractType: contractTypeFilter,
      daysRemaining: daysRemainingFilter,
      ownerUserId: ownerFilter,
      search,
      page: page > 1 ? String(page) : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const str = q.toString();
    return str ? `/contracts?${str}` : '/contracts';
  }

  return (
    <div className="px-4 lg:px-6 py-5 max-w-[1920px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract List</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Find and manage contracts, project status, BOQ, payments, and issues.</p>
          <div className="mt-2"><DashboardScopeBadge scope={scope} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <Link
              href="/contracts/new"
              className="inline-flex items-center h-10 px-5 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              + New Contract Register
            </Link>
          )}
          <Link
            href="/contracts/dashboard"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <LayoutDashboard className="size-3.5 shrink-0" aria-hidden="true" />
            Open Dashboard
          </Link>
          <button
            type="button"
            disabled
            title="Export to Excel is planned for a future unit"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-surface-secondary text-text-muted text-sm cursor-not-allowed"
          >
            <Download className="size-3.5 shrink-0" aria-hidden="true" />
            Export Excel
          </button>
        </div>
      </div>

      <ContractSummaryCards summary={summary} needsAttention={needsAttention} buildHref={buildHref} />

      <ContractFilterBar
        search={search}
        lifecycleStatus={lifecycleFilter}
        status={statusFilter}
        daysRemaining={daysRemainingFilter}
        carried={{ scheduleStatus: scheduleStatusFilter, contractType: contractTypeFilter, ownerUserId: ownerFilter }}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {contracts.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <p className="text-sm font-medium text-text-primary">{hasActiveFilters ? 'No contracts found' : 'No contracts yet.'}</p>
          {hasActiveFilters && <p className="mt-1 text-xs text-text-muted">Try clearing filters or searching another contract.</p>}
          {canCreate && !hasActiveFilters && (
            <Link
              href="/contracts/new"
              className="mt-4 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Create first contract
            </Link>
          )}
        </div>
      ) : (
        <>
          <ContractListTable
            contracts={contracts}
            boqProgress={boqProgress}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
          />

          {/* CM-55D — the accurate "Showing X to Y of Z contracts" count now lives in
              ContractListTable's own top row; this block is Previous/Next navigation only. */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end">
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildHref({ page: String(page - 1) })}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildHref({ page: String(page + 1) })}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
