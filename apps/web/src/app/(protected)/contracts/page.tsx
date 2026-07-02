import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { PageHeader } from '../administration/_components/page-header';
import { ContractLifecycleBadge } from './_components/contract-lifecycle-badge';
import { contractsApi } from '../../../lib/contracts-api';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Contracts — RECAFCO FMP' };

async function getUserPermissions(): Promise<string[]> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return [];
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function ContractsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('contracts.create');

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const lifecycleFilter = typeof params['lifecycleStatus'] === 'string' ? params['lifecycleStatus'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  const [listRes, summaryRes] = await Promise.allSettled([
    contractsApi.list({
      page,
      pageSize: 25,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(lifecycleFilter ? { lifecycleStatus: lifecycleFilter } : {}),
      ...(search ? { search } : {}),
    }),
    contractsApi.summary(),
  ]);

  let error: string | null = null;
  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  if (listRes.status === 'rejected') {
    error = listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load contracts';
  }

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
  const contracts = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;

  const quickFilters: { label: string; lifecycle?: string; status?: string }[] = [
    { label: 'All' },
    { label: 'Draft', status: 'DRAFT' },
    { label: 'Active', status: 'ACTIVE' },
    { label: 'Expiring', lifecycle: 'EXPIRING' },
    { label: 'Expired', lifecycle: 'EXPIRED' },
  ];

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged = {
      status: statusFilter,
      lifecycleStatus: lifecycleFilter,
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
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: 'Contracts' }]} />

        <div className="mb-6">
          <PageHeader
            title="Contracts"
            description="Vendor and service contracts. Ref format: CONTRACT-YYYY-NNNNNN"
            action={
              canCreate ? (
                <Link
                  href="/contracts/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  New Contract
                </Link>
              ) : undefined
            }
          />
        </div>

        {/* Summary stat cards */}
        {summary && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Active</p>
              <p className="text-xl font-semibold text-success">{summary.totalActive}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Expiring</p>
              <p className="text-xl font-semibold text-warning">{summary.totalExpiring}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Expired</p>
              <p className="text-xl font-semibold text-danger">{summary.totalExpired}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Draft</p>
              <p className="text-xl font-semibold text-text-primary">{summary.totalDraft}</p>
            </div>
          </div>
        )}

        {/* Quick filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {quickFilters.map((f) => {
            const active =
              f.lifecycle !== undefined
                ? lifecycleFilter === f.lifecycle
                : f.status !== undefined
                  ? statusFilter === f.status && !lifecycleFilter
                  : !statusFilter && !lifecycleFilter;
            return (
              <Link
                key={f.label}
                href={buildHref({
                  status: f.status,
                  lifecycleStatus: f.lifecycle,
                  page: undefined,
                })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-accent text-white' : 'bg-surface border border-border text-text-secondary hover:border-border-strong'}`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Search */}
        <form method="GET" action="/contracts" className="mb-6 flex gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {lifecycleFilter && <input type="hidden" name="lifecycleStatus" value={lifecycleFilter} />}
          <input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search by reference, title or counterparty…"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Table */}
        {contracts.length === 0 && !error ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <p className="text-sm text-text-secondary">
              {search ?? statusFilter ?? lifecycleFilter
                ? 'No contracts match the current filters.'
                : 'No contracts yet.'}
            </p>
            {canCreate && !(search ?? statusFilter ?? lifecycleFilter) && (
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
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden sm:table-cell">End Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden md:table-cell">Counterparty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden lg:table-cell">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="font-mono text-xs font-medium text-accent hover:underline"
                        >
                          {contract.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="text-sm font-medium text-text-primary hover:text-accent"
                        >
                          {contract.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <ContractLifecycleBadge status={contract.lifecycleStatus} />
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                        {contract.endDate ? formatDate(contract.endDate) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden md:table-cell">
                        {contract.counterpartyName}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                        {contract.ownerUser.displayName}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden xl:table-cell">
                        {contract.department ? contract.department.name : <span className="text-text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
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
    </div>
  );
}
