import Link from 'next/link';
import type { Metadata } from 'next';
import { plants } from '@/lib/organizations-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../_components/page-header';
import { StatusBadge } from '../_components/status-badge';
import { EmptyState } from '../_components/empty-state';
import { ErrorState } from '../_components/error-state';

export const metadata: Metadata = { title: 'Plants — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function PlantsPage(): Promise<React.JSX.Element> {
  let data: Awaited<ReturnType<typeof plants.list>> | null = null;
  let loadError: string | null = null;

  try {
    data = await plants.list({ pageSize: 100 });
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Plants' },
          ]}
        />

        <PageHeader
          title="Plants"
          description="Production plants and facilities."
          action={
            <Link
              href="/administration/plants/new"
              className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Plant
            </Link>
          }
        />

        {loadError ? (
          <ErrorState message={loadError} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No plants yet" description="Add the first plant to get started." />
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((plant) => (
                  <tr key={plant.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{plant.code}</td>
                    <td className="px-4 py-3 text-text-primary">{plant.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={plant.isActive} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/administration/plants/${plant.id}/edit`}
                        className="text-xs font-medium text-accent hover:text-accent-hover"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border text-xs text-text-muted">
              {data.pagination.total} plant{data.pagination.total !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
