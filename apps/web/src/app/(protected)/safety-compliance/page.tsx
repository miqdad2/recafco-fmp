import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../_components/breadcrumbs';
import { PageHeader } from '../administration/_components/page-header';
import { InspectionStatusBadge } from './_components/inspection-status-badge';
import { SafetyModuleNav } from './_components/safety-module-nav';
import { safetyApi } from '../../../lib/safety-api';

type PageSearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Safety Records — RECAFCO FMP' };

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

/**
 * FMP-UI-21 — this page (the Safety Records list) had no way back to the
 * Safety Dashboard or the Platform Dashboard except the browser's own back
 * button, and its breadcrumb/title just repeated "Safety & Compliance"
 * with no context, per this unit's own brief. Added the same
 * `SafetyModuleNav` row (Back to Safety Dashboard / Back to Platform
 * Dashboard / Previous / Next / Switch module) the Task List page got in
 * FMP-UI-20I, plus a 3-level breadcrumb ("Platform Dashboard > Safety &
 * Compliance > Safety Records", was 1 level with no `href`). Title/
 * subtitle changed to "Safety Records" / "View, search, and open safety
 * inspections and findings." Create button relabeled "+ New Safety
 * Inspection" (was "New Inspection" / "Create first inspection" — same
 * route, `/safety-compliance/new`, unchanged). No "Record Finding" button
 * here either — same audit result as the Safety Dashboard (see that
 * page's own doc comment): findings can only be created from within a
 * specific inspection, never from this list. No filter, search,
 * pagination, or table behavior changed.
 */
export default async function SafetyCompliancePage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('safety.create');

  const statusFilter = typeof params['status'] === 'string' ? params['status'] : undefined;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;

  let result: Awaited<ReturnType<typeof safetyApi.list>> | null = null;
  let error: string | null = null;

  try {
    result = await safetyApi.list({
      page,
      pageSize: 25,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search ? { search } : {}),
    });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load inspections';
  }

  const inspections = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;

  const quickFilters: { label: string; value: string | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Scheduled', value: 'SCHEDULED' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Completed', value: 'COMPLETED' },
  ];

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged = { status: statusFilter, search, page: page > 1 ? String(page) : undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const str = q.toString();
    return str ? `/safety-compliance?${str}` : '/safety-compliance';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-3">
          <Breadcrumbs items={[
            { label: 'Platform Dashboard', href: '/dashboard' },
            { label: 'Safety & Compliance', href: '/safety-compliance/executive' },
            { label: 'Safety Records' },
          ]} className="mb-0" />
          <SafetyModuleNav permissions={permissions} />
        </div>

        <div className="mb-6 mt-8">
          <PageHeader
            title="Safety Records"
            description="View, search, and open safety inspections and findings."
            action={
              canCreate ? (
                <Link
                  href="/safety-compliance/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  + New Safety Inspection
                </Link>
              ) : undefined
            }
          />
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {quickFilters.map((f) => {
            const active = statusFilter === f.value;
            return (
              <Link
                key={f.label}
                href={buildHref({ status: f.value, page: undefined })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-accent text-white' : 'bg-surface border border-border text-text-secondary hover:border-border-strong'}`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Search */}
        <form method="GET" action="/safety-compliance" className="mb-6 flex gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search by reference or title…"
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
        {inspections.length === 0 && !error ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            {search ?? statusFilter ? (
              <p className="text-sm text-text-secondary">No inspections match the current filters.</p>
            ) : canCreate ? (
              <>
                <p className="text-sm text-text-secondary">No safety inspections yet.</p>
                <p className="mt-1 text-sm text-text-secondary">Create the first safety inspection to start tracking compliance.</p>
                <Link
                  href="/safety-compliance/new"
                  className="mt-4 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
                >
                  + New Safety Inspection
                </Link>
              </>
            ) : (
              <p className="text-sm text-text-secondary">No safety inspections in your current scope.</p>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden sm:table-cell">Scheduled</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden md:table-cell">Inspector</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden lg:table-cell">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inspections.map((insp) => (
                    <tr key={insp.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/safety-compliance/${insp.id}`}
                          className="font-mono text-xs font-medium text-accent hover:underline"
                        >
                          {insp.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/safety-compliance/${insp.id}`}
                          className="text-sm font-medium text-text-primary hover:text-accent"
                        >
                          {insp.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <InspectionStatusBadge status={insp.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                        {insp.scheduledAt ? formatDate(insp.scheduledAt) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden md:table-cell">
                        {insp.inspector ? insp.inspector.displayName : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                        {insp.department ? insp.department.name : <span className="text-text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                <span>Showing {inspections.length} of {total}</span>
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
