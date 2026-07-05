import type { Metadata } from 'next';
import { locations } from '@/lib/organizations-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../_components/page-header';
import { StatusBadge } from '../_components/status-badge';
import { EmptyState } from '../_components/empty-state';
import { ErrorState } from '../_components/error-state';
import { OrgLifecycleActions } from '../_components/lifecycle-actions';
import {
  activateLocationAction,
  deactivateLocationAction,
  archiveLocationAction,
  getLocationDependenciesAction,
  deleteLocationAction,
} from './actions';

export const metadata: Metadata = { title: 'Locations — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function LocationsPage(): Promise<React.JSX.Element> {
  let data: Awaited<ReturnType<typeof locations.list>> | null = null;
  let loadError: string | null = null;

  try {
    data = await locations.list({ pageSize: 100 });
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Locations' },
          ]}
        />

        <PageHeader
          title="Locations"
          description="Physical locations within plants or independent areas."
          action={
            <a
              href="/administration/locations/new"
              className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Location
            </a>
          }
        />

        {loadError ? (
          <ErrorState message={loadError} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No locations yet" description="Add the first location to get started." />
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Plant</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((loc) => (
                  <tr key={loc.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{loc.code}</td>
                    <td className="px-4 py-3 text-text-primary">{loc.name}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {loc.plant
                        ? `${loc.plant.code} — ${loc.plant.name}`
                        : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={loc.isActive} isArchived={loc.archivedAt !== null} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <OrgLifecycleActions
                        id={loc.id}
                        code={loc.code}
                        name={loc.name}
                        isActive={loc.isActive}
                        isArchived={loc.archivedAt !== null}
                        editHref={`/administration/locations/${loc.id}/edit`}
                        activateAction={activateLocationAction}
                        deactivateAction={deactivateLocationAction}
                        archiveAction={archiveLocationAction}
                        getDependenciesAction={getLocationDependenciesAction}
                        deleteAction={deleteLocationAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border text-xs text-text-muted">
              {data.pagination.total} location{data.pagination.total !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
