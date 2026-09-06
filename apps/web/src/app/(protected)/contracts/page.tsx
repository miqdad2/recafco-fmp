import Link from 'next/link';
import type { Metadata } from 'next';
import { Download, LayoutDashboard } from 'lucide-react';
import { DashboardScopeBadge } from '../_components/dashboard-scope-badge';
import { ContractSummaryCards } from './_components/contract-summary-cards';
import { ContractFilterBar } from './_components/contract-filter-bar';
import { ContractListTable } from './_components/contract-list-table';
import { contractsApi } from '../../../lib/contracts-api';
import { getUserPermissions } from './_lib/get-user-permissions';

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
  const ownerFilter = typeof params['ownerUserId'] === 'string' ? params['ownerUserId'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  const hasActiveFilters = Boolean(
    lifecycleFilter ?? scheduleStatusFilter ?? contractTypeFilter ?? daysRemainingFilter ?? ownerFilter ?? search,
  );

  // CM-69I — the exact same filter scope passed to both list() (the table)
  // and summary() (the KPI cards), so the two can never disagree about what
  // "currently visible" means — no separate global/filter-blind KPI query.
  const filterParams = {
    ...(lifecycleFilter ? { lifecycleStatus: lifecycleFilter } : {}),
    ...(scheduleStatusFilter ? { scheduleStatus: scheduleStatusFilter } : {}),
    ...(contractTypeFilter ? { contractType: contractTypeFilter } : {}),
    ...(daysRemainingFilter ? { daysRemaining: daysRemainingFilter } : {}),
    ...(ownerFilter ? { ownerUserId: ownerFilter } : {}),
    ...(search ? { search } : {}),
  };

  const [listRes, summaryRes, dashboardRes, peopleRes, closeoutsRes] = await Promise.allSettled([
    contractsApi.list({ page, pageSize: PAGE_SIZE, ...filterParams }),
    contractsApi.summary(filterParams),
    contractsApi.dashboard(),
    contractsApi.people(),
    // CM-43 — reuses the existing CM-38 closeout register (pendingOnly) purely
    // to know which contracts have a request awaiting review, so the row's
    // primary action can become "Review Closeout" — no new backend endpoint.
    contractsApi.listCloseouts({ pendingOnly: true, pageSize: 100 }),
  ]);

  let error: string | null = null;
  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  if (listRes.status === 'rejected') {
    error = listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load contracts';
  }

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
  const scope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const contracts = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const pendingCloseoutContractIds = new Set(
    closeoutsRes.status === 'fulfilled' ? closeoutsRes.value.items.map((c) => c.contractId) : [],
  );

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged = {
      lifecycleStatus: lifecycleFilter,
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
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract List</h1>
          <p className="mt-1.5 text-sm text-text-secondary">View and manage all contracts in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardScopeBadge scope={scope} />
          {canCreate && (
            <Link
              href="/contracts/new"
              className="inline-flex items-center h-10 px-5 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              + New Contract Register
            </Link>
          )}
          <button
            type="button"
            disabled
            title="Export to Excel is planned for a future unit"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-surface-secondary text-text-muted text-sm cursor-not-allowed"
          >
            <Download className="size-3.5 shrink-0" aria-hidden="true" />
            Export Excel
          </button>
          <Link
            href="/contracts/dashboard"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <LayoutDashboard className="size-3.5 shrink-0" aria-hidden="true" />
            Open Dashboard
          </Link>
        </div>
      </div>

      <ContractSummaryCards summary={summary} buildHref={buildHref} />

      <ContractFilterBar
        search={search}
        scheduleStatus={scheduleStatusFilter}
        contractType={contractTypeFilter}
        ownerUserId={ownerFilter}
        daysRemaining={daysRemainingFilter}
        lifecycleStatus={lifecycleFilter}
        people={people}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {contracts.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">
            {hasActiveFilters ? 'No contracts match the current filters.' : 'No contracts yet.'}
          </p>
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
            permissions={permissions}
            pendingCloseoutContractIds={pendingCloseoutContractIds}
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
