import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../../administration/_components/page-header';
import { productionApi } from '../../../../lib/production-api';

export const metadata: Metadata = { title: 'Production Lines — RECAFCO FMP' };

type PageSearchParams = Record<string, string | string[] | undefined>;

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

interface PageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function ProductionLinesPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const permissions = await getUserPermissions();
  const canCreate = permissions.includes('production.lines.create');

  const page = typeof params['page'] === 'string' ? parseInt(params['page'], 10) : 1;
  const search = typeof params['search'] === 'string' ? params['search'] : undefined;
  const isActiveParam = typeof params['isActive'] === 'string' ? params['isActive'] : undefined;

  const [listRes] = await Promise.allSettled([
    productionApi.listLines({
      page,
      pageSize: 25,
      ...(search ? { search } : {}),
      ...(isActiveParam === 'true' ? { isActive: true } : isActiveParam === 'false' ? { isActive: false } : {}),
    }),
  ]);

  const result = listRes.status === 'fulfilled' ? listRes.value : null;
  const error = listRes.status === 'rejected'
    ? (listRes.reason instanceof Error ? listRes.reason.message : 'Failed to load production lines')
    : null;

  const lines = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;

  function buildHref(overrides: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    const merged = { search, isActive: isActiveParam, page: page > 1 ? String(page) : undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '') q.set(k, v);
    }
    const str = q.toString();
    return str ? `/production/lines?${str}` : '/production/lines';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[{ label: 'Production Dashboard', href: '/production' }, { label: 'Lines' }]} />

        <div className="mb-6">
          <PageHeader
            title="Production Lines"
            description="Factory production lines. Each line can be assigned orders and has optional capacity."
            action={
              canCreate ? (
                <Link
                  href="/production/lines/new"
                  className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  New Line
                </Link>
              ) : undefined
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[{ label: 'All', value: undefined }, { label: 'Active', value: 'true' }, { label: 'Inactive', value: 'false' }].map((f) => {
            const active = (f.value ?? '') === (isActiveParam ?? '');
            return (
              <Link
                key={f.label}
                href={buildHref({ isActive: f.value, page: undefined })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-accent text-white' : 'bg-surface border border-border text-text-secondary hover:border-border-strong'}`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <form method="GET" action="/production/lines" className="mb-6 flex gap-2">
          {isActiveParam && <input type="hidden" name="isActive" value={isActiveParam} />}
          <input
            name="search" type="search" defaultValue={search}
            placeholder="Search by code or name…"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
            Search
          </button>
        </form>

        {error && (
          <div className="mb-6 rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {lines.length === 0 && !error ? (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <p className="text-sm text-text-secondary">
              {search ? 'No lines match the search.' : 'No production lines configured yet.'}
            </p>
            {canCreate && !search && (
              <Link href="/production/lines/new" className="mt-4 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
                Create first line
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden sm:table-cell">Plant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden md:table-cell">Capacity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-text-primary">{line.code}</td>
                      <td className="px-4 py-3 text-sm text-text-primary">{line.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${line.isActive ? 'bg-success-light text-success border border-success/30' : 'bg-surface border border-border text-text-muted'}`}>
                          {line.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                        {line.plant ? line.plant.name : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary hidden md:table-cell">
                        {line.capacity != null ? `${line.capacity} units/shift` : <span className="text-text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                <span>Showing {lines.length} of {total}</span>
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
