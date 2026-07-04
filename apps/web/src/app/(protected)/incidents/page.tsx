import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { PageHeader } from '../administration/_components/page-header';
import { IncidentStatusBadge } from './_components/incident-status-badge';
import { IncidentSeverityBadge } from './_components/incident-severity-badge';
import { incidentsApi } from '../../../lib/incidents-api';
import type { IncidentStatus, IncidentSeverity, IncidentListQuery } from '../../../lib/incidents-api';
import { cookies } from 'next/headers';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Incident Report — RECAFCO FMP' };

const OPEN_STATUSES: IncidentStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATION', 'ACTION_REQUIRED'];

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

export default async function IncidentsPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('incidents.create');

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const severityFilter = typeof params['severity'] === 'string' ? params['severity'] : undefined;
  const plantFilter = typeof params['affectedPlantId'] === 'string' ? params['affectedPlantId'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const dateFrom = typeof params['dateFrom'] === 'string' ? params['dateFrom'] : undefined;
  const dateTo = typeof params['dateTo'] === 'string' ? params['dateTo'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  let incidents: Awaited<ReturnType<typeof incidentsApi.list>> | null = null;
  let error: string | null = null;

  try {
    const query: IncidentListQuery = { page, pageSize: 20 };
    if (statusFilter === 'open') {
      query.status = OPEN_STATUSES.join(',');
    } else if (statusFilter) {
      query.status = statusFilter;
    }
    if (severityFilter) query.severity = severityFilter;
    if (plantFilter) query.affectedPlantId = plantFilter;
    if (search) query.search = search;
    if (dateFrom) query.dateFrom = dateFrom;
    if (dateTo) query.dateTo = dateTo;
    incidents = await incidentsApi.list(query);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load incidents';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: 'Incident Report' }]} />

        <div className="mb-6">
          <PageHeader
            title="Incident Report"
            description="Report and track incidents, near-misses, and safety events across all facilities."
            action={
              canCreate ? (
                <Link
                  href="/incidents/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Report Incident
                </Link>
              ) : undefined
            }
          />
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
              <option value="open">Open (active)</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="INVESTIGATION">Investigation</option>
              <option value="ACTION_REQUIRED">Action Required</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="severity-filter" className="block text-xs font-medium text-text-secondary mb-1">Severity</label>
            <select
              id="severity-filter"
              name="severity"
              defaultValue={severityFilter ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="date-from" className="block text-xs font-medium text-text-secondary mb-1">From</label>
            <input id="date-from" name="dateFrom" type="date" defaultValue={dateFrom}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="date-to" className="block text-xs font-medium text-text-secondary mb-1">To</label>
            <input id="date-to" name="dateTo" type="date" defaultValue={dateTo}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-border bg-surface-secondary px-4 py-1.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Filter
          </button>
          {(statusFilter ?? severityFilter ?? search ?? dateFrom ?? dateTo) && (
            <Link href="/incidents" className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-primary focus:outline-none">
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

        {/* Table */}
        {incidents && incidents.items.length === 0 && (
          <div className="rounded-lg border border-border bg-surface py-16 text-center">
            <p className="text-sm text-text-muted">No incidents found.</p>
            {canCreate && (
              <Link href="/incidents/new" className="mt-2 inline-block text-sm text-accent hover:underline">
                Report an incident
              </Link>
            )}
          </div>
        )}

        {incidents && incidents.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Occurred</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Reported by</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Assigned to</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {incidents.items.map((incident) => (
                    <tr key={incident.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="font-mono text-xs text-accent hover:underline focus:outline-none focus:underline"
                        >
                          {incident.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="text-text-primary hover:text-accent line-clamp-2 focus:outline-none focus:underline"
                        >
                          {incident.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <IncidentSeverityBadge severity={incident.severity as IncidentSeverity} />
                      </td>
                      <td className="px-4 py-3">
                        <IncidentStatusBadge status={incident.status as IncidentStatus} />
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {formatDate(incident.occurredAt)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {incident.reportedByUser.displayName}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {incident.assignedToUser?.displayName ?? (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {incidents.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                <span>
                  Showing {(incidents.pagination.page - 1) * incidents.pagination.pageSize + 1}–
                  {Math.min(incidents.pagination.page * incidents.pagination.pageSize, incidents.pagination.total)} of{' '}
                  {incidents.pagination.total}
                </span>
                <div className="flex gap-2">
                  {incidents.pagination.page > 1 && (
                    <Link
                      href={{ query: { ...params, page: incidents.pagination.page - 1 } }}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      Previous
                    </Link>
                  )}
                  {incidents.pagination.page < incidents.pagination.totalPages && (
                    <Link
                      href={{ query: { ...params, page: incidents.pagination.page + 1 } }}
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
