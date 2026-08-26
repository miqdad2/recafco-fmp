import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { contractsApi } from '../../../../lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { ScheduleSummaryCards } from './_components/schedule-summary-cards';
import { ScheduleFilterBar } from './_components/schedule-filter-bar';
import { ScheduleListTable } from './_components/schedule-list-table';
import { ScheduleActionsBar } from './_components/schedule-actions-bar';

export const metadata: Metadata = { title: 'Contract Schedule — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

export default async function ContractSchedulePage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  const params = await searchParams;
  const search = str(params['search']);
  const contractId = str(params['contractId']);
  const itemType = str(params['itemType']);
  const responsibleUserId = str(params['responsibleUserId']);
  const departmentId = str(params['departmentId']);
  const dateFrom = str(params['dateFrom']);
  const dateTo = str(params['dateTo']);
  const overdueOnly = str(params['overdueOnly']) === 'true';
  const upcomingOnly = str(params['upcomingOnly']) === 'true';
  const page = str(params['page']) ? parseInt(str(params['page'])!, 10) : 1;

  const hasActiveFilters = Boolean(
    search || contractId || itemType || responsibleUserId || departmentId || dateFrom || dateTo || overdueOnly || upcomingOnly,
  );

  const [listRes, contractsRes, deptsRes, peopleRes, dashboardRes] = await Promise.allSettled([
    contractsApi.listSchedule({
      page,
      pageSize: 50,
      ...(search ? { search } : {}),
      ...(contractId ? { contractId } : {}),
      ...(itemType ? { itemType } : {}),
      ...(responsibleUserId ? { responsibleUserId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(overdueOnly ? { overdueOnly } : {}),
      ...(upcomingOnly ? { upcomingOnly } : {}),
    }),
    contractsApi.list({ pageSize: 100 }),
    contractsApi.departments(),
    contractsApi.people(),
    contractsApi.dashboard(),
  ]);

  let error: string | null = null;
  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  if (listRes.status === 'rejected') {
    error = listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load schedule data';
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
      search, contractId, itemType, responsibleUserId, departmentId, dateFrom, dateTo,
      overdueOnly: overdueOnly ? 'true' : undefined,
      upcomingOnly: upcomingOnly ? 'true' : undefined,
      page: page > 1 ? String(page) : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const s = q.toString();
    return s ? `/contracts/schedule?${s}` : '/contracts/schedule';
  }

  const generatedAt = new Date().toLocaleTimeString('en-GB');

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6 print:px-0 print:py-0">
      <Breadcrumbs
        items={[{ label: 'Contract Management', href: '/contracts/dashboard' }, { label: 'Schedule' }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract Schedule</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Track contract timelines, workflow due dates, payments, claims, issues and closeout milestones in one schedule view.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardScopeBadge scope={scope} />
          <span className="text-xs text-text-muted">Last refreshed {generatedAt}</span>
          <ScheduleActionsBar />
        </div>
      </div>

      {/* Print-only header — the on-screen title above is hidden when printing so this one, with filter context, takes its place. */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Contract Schedule</h1>
        <p className="text-xs text-text-secondary">
          Generated {new Date().toLocaleString('en-GB')}
          {hasActiveFilters ? ' — filtered view' : ' — all schedule items'}
        </p>
      </div>

      <ScheduleSummaryCards summary={summary} />

      <ScheduleFilterBar
        search={search}
        contractId={contractId}
        itemType={itemType}
        responsibleUserId={responsibleUserId}
        departmentId={departmentId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        overdueOnly={overdueOnly}
        upcomingOnly={upcomingOnly}
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

      <ScheduleListTable items={items} />

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
