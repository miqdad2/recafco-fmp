import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { contractsApi } from '../../../../lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { CloseoutSummaryCards } from './_components/closeout-summary-cards';
import { CloseoutFilterBar } from './_components/closeout-filter-bar';
import { CloseoutRegisterTable } from './_components/closeout-register-table';
import { CloseoutActionsBar } from './_components/closeout-actions-bar';

export const metadata: Metadata = { title: 'Closeout Requests — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

export default async function ContractCloseoutsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();
  const canClose = permissions.includes('contracts.close');

  const params = await searchParams;
  const search = str(params['search']);
  const contractId = str(params['contractId']);
  const status = str(params['status']);
  const requestedByUserId = str(params['requestedByUserId']);
  const reviewedByUserId = str(params['reviewedByUserId']);
  const departmentId = str(params['departmentId']);
  const requestedDateFrom = str(params['requestedDateFrom']);
  const requestedDateTo = str(params['requestedDateTo']);
  const reviewedDateFrom = str(params['reviewedDateFrom']);
  const reviewedDateTo = str(params['reviewedDateTo']);
  const approvedDateFrom = str(params['approvedDateFrom']);
  const approvedDateTo = str(params['approvedDateTo']);
  const pendingOnly = str(params['pendingOnly']) === 'true';
  const page = str(params['page']) ? parseInt(str(params['page'])!, 10) : 1;

  const hasActiveFilters = Boolean(
    search || contractId || status || requestedByUserId || reviewedByUserId || departmentId ||
    requestedDateFrom || requestedDateTo || reviewedDateFrom || reviewedDateTo ||
    approvedDateFrom || approvedDateTo || pendingOnly,
  );

  const [listRes, contractsRes, deptsRes, peopleRes, dashboardRes] = await Promise.allSettled([
    contractsApi.listCloseouts({
      page,
      pageSize: 25,
      ...(search ? { search } : {}),
      ...(contractId ? { contractId } : {}),
      ...(status ? { status } : {}),
      ...(requestedByUserId ? { requestedByUserId } : {}),
      ...(reviewedByUserId ? { reviewedByUserId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(requestedDateFrom ? { requestedDateFrom } : {}),
      ...(requestedDateTo ? { requestedDateTo } : {}),
      ...(reviewedDateFrom ? { reviewedDateFrom } : {}),
      ...(reviewedDateTo ? { reviewedDateTo } : {}),
      ...(approvedDateFrom ? { approvedDateFrom } : {}),
      ...(approvedDateTo ? { approvedDateTo } : {}),
      ...(pendingOnly ? { pendingOnly } : {}),
    }),
    contractsApi.list({ pageSize: 100 }),
    contractsApi.departments(),
    contractsApi.people(),
    contractsApi.dashboard(),
  ]);

  let error: string | null = null;
  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  if (listRes.status === 'rejected') {
    error = listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load closeout requests';
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const summary = result?.summary ?? null;

  const contracts = (contractsRes.status === 'fulfilled' ? contractsRes.value.items : []).map((c) => ({
    id: c.id,
    referenceNumber: c.referenceNumber,
    title: c.title,
  }));
  const departments = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const scope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      search, contractId, status, requestedByUserId, reviewedByUserId, departmentId,
      requestedDateFrom, requestedDateTo, reviewedDateFrom, reviewedDateTo, approvedDateFrom, approvedDateTo,
      pendingOnly: pendingOnly ? 'true' : undefined,
      page: page > 1 ? String(page) : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const s = q.toString();
    return s ? `/contracts/closeouts?${s}` : '/contracts/closeouts';
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6 print:px-0 print:py-0">
      <Breadcrumbs
        items={[{ label: 'Contract Management', href: '/contracts/dashboard' }, { label: 'Closeout Requests' }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Closeout Requests</h1>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            Review contract closeout requests, readiness risks, approval status and final closure actions across
            all contracts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardScopeBadge scope={scope} />
          <CloseoutActionsBar />
        </div>
      </div>

      {/* Print-only header — the on-screen title above is hidden when printing so this one, with filter context, takes its place. */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Closeout Requests</h1>
        <p className="text-xs text-text-secondary">
          Generated {new Date().toLocaleString('en-GB')}
          {hasActiveFilters ? ' — filtered view' : ' — all closeout requests'}
        </p>
      </div>

      <CloseoutSummaryCards summary={summary} />

      <CloseoutFilterBar
        search={search}
        contractId={contractId}
        status={status}
        requestedByUserId={requestedByUserId}
        reviewedByUserId={reviewedByUserId}
        departmentId={departmentId}
        requestedDateFrom={requestedDateFrom}
        requestedDateTo={requestedDateTo}
        reviewedDateFrom={reviewedDateFrom}
        reviewedDateTo={reviewedDateTo}
        approvedDateFrom={approvedDateFrom}
        approvedDateTo={approvedDateTo}
        pendingOnly={pendingOnly}
        contracts={contracts}
        departments={departments}
        people={people}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <CloseoutRegisterTable items={items} canClose={canClose} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary print:hidden">
          <span>Showing {items.length} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={buildHref({ page: String(page - 1) })} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong">
                Previous
              </a>
            )}
            {page < totalPages && (
              <a href={buildHref({ page: String(page + 1) })} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong">
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
