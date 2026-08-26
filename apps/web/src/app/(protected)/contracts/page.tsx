import Link from 'next/link';
import type { Metadata } from 'next';
import { Download, LayoutDashboard } from 'lucide-react';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { DashboardScopeBadge } from '../_components/dashboard-scope-badge';
import { ContractSummaryCards } from './_components/contract-summary-cards';
import { ContractFilterBar } from './_components/contract-filter-bar';
import { ContractListTable } from './_components/contract-list-table';
import { NewContractRegisterModal } from './_components/new-contract-register-modal';
import { contractsApi } from '../../../lib/contracts-api';
import { getUserPermissions } from './_lib/get-user-permissions';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Contract List — RECAFCO FMP' };

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function ContractsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('contracts.create');

  const lifecycleFilter = typeof params['lifecycleStatus'] === 'string' ? params['lifecycleStatus'] : undefined;
  const departmentFilter = typeof params['departmentId'] === 'string' ? params['departmentId'] : undefined;
  const ownerFilter = typeof params['ownerUserId'] === 'string' ? params['ownerUserId'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  const hasActiveFilters = Boolean(lifecycleFilter ?? departmentFilter ?? ownerFilter ?? search);

  const [listRes, summaryRes, dashboardRes, deptsRes, peopleRes, plantsRes, locationsRes, closeoutsRes] = await Promise.allSettled([
    contractsApi.list({
      page,
      pageSize: 25,
      ...(lifecycleFilter ? { lifecycleStatus: lifecycleFilter } : {}),
      ...(departmentFilter ? { departmentId: departmentFilter } : {}),
      ...(ownerFilter ? { ownerUserId: ownerFilter } : {}),
      ...(search ? { search } : {}),
    }),
    contractsApi.summary(),
    contractsApi.dashboard(),
    contractsApi.departments(),
    contractsApi.people(),
    contractsApi.plants(),
    contractsApi.locations(),
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
  const departments = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const plants = plantsRes.status === 'fulfilled' ? plantsRes.value : [];
  const locations = locationsRes.status === 'fulfilled' ? locationsRes.value : [];
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
      departmentId: departmentFilter,
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
      <Breadcrumbs items={[{ label: 'Contract Management', href: '/contracts/dashboard' }, { label: 'Contract List' }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract List</h1>
          <p className="mt-1.5 text-sm text-text-secondary">View and manage all contracts in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardScopeBadge scope={scope} />
          {canCreate && (
            <NewContractRegisterModal depts={departments} plantsData={plants} locations={locations} people={people} scope={scope} />
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

      <ContractSummaryCards summary={summary} buildHref={buildHref} />

      <ContractFilterBar
        search={search}
        lifecycleStatus={lifecycleFilter}
        departmentId={departmentFilter}
        ownerUserId={ownerFilter}
        departments={departments}
        people={people}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
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
          <ContractListTable contracts={contracts} permissions={permissions} pendingCloseoutContractIds={pendingCloseoutContractIds} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span>Showing {contracts.length} of {total}</span>
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
