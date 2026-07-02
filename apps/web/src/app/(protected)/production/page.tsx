import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { PageHeader } from '../administration/_components/page-header';
import { productionApi } from '../../../lib/production-api';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Production — RECAFCO FMP' };

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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-surface border border-border text-text-secondary',
  SCHEDULED: 'bg-blue-50 text-blue-700 border border-blue-200',
  IN_PROGRESS: 'bg-success-light text-success border border-success/30',
  PAUSED: 'bg-warning-light text-warning border border-warning/30',
  COMPLETED: 'bg-surface text-text-muted border border-border',
  CANCELLED: 'bg-danger-light text-danger border border-danger/30',
};

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? ''}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function ProductionPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('production.create');
  const canManageLines = permissions.includes('production.lines.read');

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  const [listRes, summaryRes] = await Promise.allSettled([
    productionApi.list({ page, pageSize: 25, ...(statusFilter ? { status: statusFilter } : {}), ...(search ? { search } : {}) }),
    productionApi.summary(),
  ]);

  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  const error = listRes.status === 'rejected'
    ? (listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load production orders')
    : null;

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : null;
  const orders = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;

  const quickFilters: { label: string; status?: string }[] = [
    { label: 'All' },
    { label: 'Draft', status: 'DRAFT' },
    { label: 'Scheduled', status: 'SCHEDULED' },
    { label: 'In Progress', status: 'IN_PROGRESS' },
    { label: 'Paused', status: 'PAUSED' },
  ];

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged = { status: statusFilter, search, page: page > 1 ? String(page) : undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const str = q.toString();
    return str ? `/production?${str}` : '/production';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: 'Production' }]} />

        <div className="mb-6">
          <PageHeader
            title="Production"
            description="Production orders and manufacturing runs. Ref format: PROD-YYYY-NNNNNN"
            action={
              <div className="flex gap-2">
                {canManageLines && (
                  <Link
                    href="/production/lines"
                    className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    Production Lines
                  </Link>
                )}
                {canCreate && (
                  <Link
                    href="/production/new"
                    className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    New Order
                  </Link>
                )}
              </div>
            }
          />
        </div>

        {summary && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">In Progress</p>
              <p className="text-xl font-semibold text-success">{summary.totalInProgress}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Scheduled</p>
              <p className="text-xl font-semibold text-blue-600">{summary.totalScheduled}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Paused</p>
              <p className="text-xl font-semibold text-warning">{summary.totalPaused}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Completed</p>
              <p className="text-xl font-semibold text-text-secondary">{summary.totalCompleted}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[110px]">
              <p className="text-xs text-text-muted mb-0.5">Draft</p>
              <p className="text-xl font-semibold text-text-primary">{summary.totalDraft}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {quickFilters.map((f) => {
            const active = f.status !== undefined ? statusFilter === f.status : !statusFilter;
            return (
              <Link
                key={f.label}
                href={buildHref({ status: f.status, page: undefined })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-accent text-white' : 'bg-surface border border-border text-text-secondary hover:border-border-strong'}`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <form method="GET" action="/production" className="mb-6 flex gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search by reference, title or product…"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus">
            Search
          </button>
        </form>

        {error && (
          <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {orders.length === 0 && !error ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <p className="text-sm text-text-secondary">
              {search ?? statusFilter ? 'No orders match the current filters.' : 'No production orders yet.'}
            </p>
            {canCreate && !(search ?? statusFilter) && (
              <Link href="/production/new" className="mt-4 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
                Create first order
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden sm:table-cell">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden md:table-cell">Line</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden lg:table-cell">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Scheduled Start</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/production/${order.id}`} className="font-mono text-xs font-medium text-accent hover:underline">
                          {order.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/production/${order.id}`} className="text-sm font-medium text-text-primary hover:text-accent">
                          {order.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                        {order.productName ?? order.productCode ?? <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden md:table-cell">
                        {order.productionLine ? order.productionLine.name : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                        {order.targetQuantity} {order.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden xl:table-cell">
                        {order.scheduledStartAt ? formatDate(order.scheduledStartAt) : <span className="text-text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                <span>Showing {orders.length} of {total}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={buildHref({ page: String(page - 1) })} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong">Previous</Link>
                  )}
                  {page < totalPages && (
                    <Link href={buildHref({ page: String(page + 1) })} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-border-strong">Next</Link>
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
