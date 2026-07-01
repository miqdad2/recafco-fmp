import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { MrStatusBadge } from '../_components/mr-status-badge';
import { MrPriorityBadge } from '../_components/mr-priority-badge';
import { maintenanceApi } from '../../../../lib/maintenance-api';
import type { MaintenanceStatus, MaintenancePriority, MrListQuery } from '../../../../lib/maintenance-api';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'My Maintenance Requests — RECAFCO FMP' };

const ACTIVE_STATUSES: MaintenanceStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_PARTS',
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isOverdue(completionAt: string | null, status: MaintenanceStatus): boolean {
  if (!completionAt) return false;
  if (!ACTIVE_STATUSES.includes(status)) return false;
  return new Date(completionAt) < new Date();
}

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function MyMaintenancePage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  let requests: Awaited<ReturnType<typeof maintenanceApi.my>> | null = null;
  let error: string | null = null;

  try {
    const query: MrListQuery = { page, pageSize: 25 };
    if (statusFilter) query.status = statusFilter;
    if (search) query.search = search;
    requests = await maintenanceApi.my(query);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load maintenance requests';
  }

  // Read JWT to get name for heading
  let displayName = 'Me';
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (token) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
      if (typeof payload.displayName === 'string') displayName = payload.displayName as string;
    }
  } catch {
    // ignore
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Maintenance Requests', href: '/maintenance' },
          { label: 'My Requests' },
        ]} />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">My Maintenance Requests</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Requests assigned to {displayName}.
          </p>
        </div>

        {/* Filters */}
        <form method="GET" className="mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="search-input" className="block text-xs font-medium text-text-secondary mb-1">Search</label>
            <input
              id="search-input"
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Reference or title…"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent w-48"
            />
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-text-secondary mb-1">Status</label>
            <select
              id="status-filter"
              name="status"
              defaultValue={statusFilter ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All statuses</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_PARTS">Waiting for Parts</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md border border-border bg-surface-secondary px-4 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Filter
          </button>
          {(statusFilter ?? search) && (
            <Link href="/maintenance/my" className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-primary focus:outline-none">
              Clear
            </Link>
          )}
        </form>

        {error && (
          <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger mb-6">
            {error}
          </div>
        )}

        {requests && requests.items.length === 0 && (
          <div className="rounded-lg border border-border bg-surface py-16 text-center">
            <p className="text-sm text-text-muted">No maintenance requests assigned to you.</p>
          </div>
        )}

        {requests && requests.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Completion Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {requests.items.map((mr) => {
                    const overdue = isOverdue(mr.requestedCompletionAt, mr.status as MaintenanceStatus);
                    return (
                      <tr key={mr.id} className="hover:bg-surface-secondary/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/maintenance/${mr.id}`}
                            className="font-mono text-xs text-accent hover:underline focus:outline-none focus:underline"
                          >
                            {mr.referenceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <Link
                            href={`/maintenance/${mr.id}`}
                            className="text-text-primary hover:text-accent line-clamp-2 focus:outline-none focus:underline"
                          >
                            {mr.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <MrPriorityBadge priority={mr.priority as MaintenancePriority} />
                        </td>
                        <td className="px-4 py-3">
                          <MrStatusBadge status={mr.status as MaintenanceStatus} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {mr.requestedCompletionAt ? (
                            <span className={overdue ? 'text-danger font-medium' : 'text-text-secondary'}>
                              {formatDate(mr.requestedCompletionAt)}
                              {overdue && <span className="ml-1 text-xs">(overdue)</span>}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {requests.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                <span>
                  Showing {(requests.pagination.page - 1) * requests.pagination.pageSize + 1}–
                  {Math.min(requests.pagination.page * requests.pagination.pageSize, requests.pagination.total)} of{' '}
                  {requests.pagination.total}
                </span>
                <div className="flex gap-2">
                  {requests.pagination.page > 1 && (
                    <Link
                      href={{ query: { ...params, page: requests.pagination.page - 1 } }}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      Previous
                    </Link>
                  )}
                  {requests.pagination.page < requests.pagination.totalPages && (
                    <Link
                      href={{ query: { ...params, page: requests.pagination.page + 1 } }}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
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
