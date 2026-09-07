import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { contractsApi } from '../../../../lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { ClaimSummaryCards } from './_components/claim-summary-cards';
import { ClaimFilterBar } from './_components/claim-filter-bar';
import { ClaimRegisterTable } from './_components/claim-register-table';
import { ClaimActionsBar } from './_components/claim-actions-bar';

export const metadata: Metadata = { title: 'Claim Log — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

export default async function ContractClaimsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();
  const canUpdate = permissions.includes('contracts.update');

  const params = await searchParams;
  const search = str(params['search']);
  const contractId = str(params['contractId']);
  const status = str(params['status']);
  const claimType = str(params['claimType']);
  const responsibleUserId = str(params['responsibleUserId']);
  const departmentId = str(params['departmentId']);
  const claimDateFrom = str(params['claimDateFrom']);
  const claimDateTo = str(params['claimDateTo']);
  const dueDateFrom = str(params['dueDateFrom']);
  const dueDateTo = str(params['dueDateTo']);
  const overdueOnly = str(params['overdueOnly']) === 'true';
  const page = str(params['page']) ? parseInt(str(params['page'])!, 10) : 1;

  const hasActiveFilters = Boolean(
    search || contractId || status || claimType || responsibleUserId || departmentId ||
    claimDateFrom || claimDateTo || dueDateFrom || dueDateTo || overdueOnly,
  );

  const [listRes, contractsRes, deptsRes, peopleRes, dashboardRes] = await Promise.allSettled([
    contractsApi.listClaims({
      page,
      pageSize: 25,
      ...(search ? { search } : {}),
      ...(contractId ? { contractId } : {}),
      ...(status ? { status } : {}),
      ...(claimType ? { claimType } : {}),
      ...(responsibleUserId ? { responsibleUserId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(claimDateFrom ? { claimDateFrom } : {}),
      ...(claimDateTo ? { claimDateTo } : {}),
      ...(dueDateFrom ? { dueDateFrom } : {}),
      ...(dueDateTo ? { dueDateTo } : {}),
      ...(overdueOnly ? { overdueOnly } : {}),
    }),
    contractsApi.list({ pageSize: 100 }),
    contractsApi.departments(),
    contractsApi.people(),
    contractsApi.dashboard(),
  ]);

  let error: string | null = null;
  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  if (listRes.status === 'rejected') {
    error = listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load claims';
  }

  const claims = result?.items ?? [];
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
      search, contractId, status, claimType, responsibleUserId, departmentId,
      claimDateFrom, claimDateTo, dueDateFrom, dueDateTo,
      overdueOnly: overdueOnly ? 'true' : undefined,
      page: page > 1 ? String(page) : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const s = q.toString();
    return s ? `/contracts/claims?${s}` : '/contracts/claims';
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6 print:px-0 print:py-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Claim Log</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Track contract claims, submitted values, approved values, deadlines and claim status across all contracts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardScopeBadge scope={scope} />
          <ClaimActionsBar />
        </div>
      </div>

      {/* Print-only header — the on-screen title above is hidden when printing so this one, with filter context, takes its place. */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Claim Log</h1>
        <p className="text-xs text-text-secondary">
          Generated {new Date().toLocaleString('en-GB')}
          {hasActiveFilters ? ' — filtered view' : ' — all claims'}
        </p>
      </div>

      <ClaimSummaryCards summary={summary} />

      <ClaimFilterBar
        search={search}
        contractId={contractId}
        status={status}
        claimType={claimType}
        responsibleUserId={responsibleUserId}
        departmentId={departmentId}
        claimDateFrom={claimDateFrom}
        claimDateTo={claimDateTo}
        dueDateFrom={dueDateFrom}
        dueDateTo={dueDateTo}
        overdueOnly={overdueOnly}
        contracts={contracts}
        departments={departments}
        people={people}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <ClaimRegisterTable claims={claims} contracts={contracts} people={people} canUpdate={canUpdate} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary print:hidden">
          <span>Showing {claims.length} of {total}</span>
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
