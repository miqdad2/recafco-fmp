import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { PageHeader } from '../administration/_components/page-header';
import { MrStatusBadge } from './_components/mr-status-badge';
import { MrPriorityBadge } from './_components/mr-priority-badge';
import { maintenanceApi } from '../../../lib/maintenance-api';
import type { MaintenanceStatus, MaintenancePriority, MrListQuery } from '../../../lib/maintenance-api';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Maintenance Requests — RECAFCO FMP' };

const ACTIVE_STATUSES: MaintenanceStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_PARTS',
];

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

function isOverdue(completionAt: string | null, status: MaintenanceStatus): boolean {
  if (!completionAt) return false;
  if (!ACTIVE_STATUSES.includes(status)) return false;
  return new Date(completionAt) < new Date();
}

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function MaintenancePage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('maintenance.create');

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const priorityFilter = typeof params['priority'] === 'string' ? params['priority'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const overdueRaw = typeof params['overdue'] === 'string' ? params['overdue'] : undefined;
  const overdueFilter = overdueRaw === 'true' ? true : overdueRaw === 'false' ? false : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  let requests: Awaited<ReturnType<typeof maintenanceApi.list>> | null = null;
  let error: string | null = null;

  try {
    const query: MrListQuery = { page, pageSize: 25 };
    if (statusFilter === 'active') {
      query.status = ACTIVE_STATUSES.join(',');
    } else if (statusFilter) {
      query.status = statusFilter;
    }
    if (priorityFilter) query.priority = priorityFilter;
    if (search) query.search = search;
    if (overdueFilter !== undefined) query.overdue = overdueFilter;
    requests = await maintenanceApi.list(query);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load maintenance requests';
  }

  const hasFilters = !!(statusFilter ?? priorityFilter ?? search ?? overdueRaw);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: 'Maintenance Requests' }]} />

        <div className="mb-6">
          <PageHeader
            title="Maintenance Requests"
            description="Submit, track, and manage equipment maintenance and repair requests."
            action={
              canCreate ? (
                <Link
                  href="/maintenance/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  New Request
                </Link>
              ) : undefined
            }
          />
        </div>

        {/* Quick filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/maintenance?status=active"
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${statusFilter === 'active' ? 'bg-accent text-white border-accent' : 'border-border bg-surface text-text-secondary hover:border-border-strong'}`}
          >
            Active
          </Link>
          <Link
            href="/maintenance?status=WAITING_FOR_PARTS"
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${statusFilter === 'WAITING_FOR_PARTS' ? 'bg-danger text-white border-danger' : 'border-border bg-surface text-text-secondary hover:border-border-strong'}`}
          >
            Waiting for Parts
          </Link>
          <Link
            href="/maintenance?overdue=true"
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${overdueFilter === true ? 'bg-danger text-white border-danger' : 'border-border bg-surface text-text-secondary hover:border-border-strong'}`}
          >
            Overdue
          </Link>
          <Link
            href="/maintenance/my"
            className="rounded-full px-3 py-1 text-xs font-medium border border-border bg-surface text-text-secondary hover:border-border-strong transition-colors"
          >
            My requests →
          </Link>
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
              <option value="active">Active (submitted through in-progress)</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_PARTS">Waiting for Parts</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority-filter" className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
            <select
              id="priority-filter"
              name="priority"
              defaultValue={priorityFilter ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md border border-border bg-surface-secondary px-4 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Filter
          </button>
          {hasFilters && (
            <Link href="/maintenance" className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-primary focus:outline-none">
              Clear
            </Link>
          )}
        </form>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger mb-6">
            {error}
          </div>
        )}

        {/* Empty state */}
        {requests && requests.items.length === 0 && (
          <div className="rounded-lg border border-border bg-surface py-16 text-center">
            <p className="text-sm text-text-muted">No maintenance requests found.</p>
            {canCreate && (
              <Link href="/maintenance/new" className="mt-2 inline-block text-sm text-accent hover:underline">
                Submit a request
              </Link>
            )}
          </div>
        )}

        {/* Table */}
        {requests && requests.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Completion Due</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Assigned to</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Department</th>
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
                        <td className="px-4 py-3 text-text-secondary">
                          {mr.assignedToUser?.displayName ?? <span className="text-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {mr.affectedDepartment?.name ?? <span className="text-text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
