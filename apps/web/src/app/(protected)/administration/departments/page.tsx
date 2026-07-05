import type { Metadata } from 'next';
import { departments } from '@/lib/organizations-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../_components/page-header';
import { StatusBadge } from '../_components/status-badge';
import { EmptyState } from '../_components/empty-state';
import { ErrorState } from '../_components/error-state';
import { OrgLifecycleActions } from '../_components/lifecycle-actions';
import {
  activateDepartmentAction,
  deactivateDepartmentAction,
  archiveDepartmentAction,
  getDepartmentDependenciesAction,
  deleteDepartmentAction,
} from './actions';

export const metadata: Metadata = { title: 'Departments – RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function DepartmentsPage(): Promise<React.JSX.Element> {
  let data: Awaited<ReturnType<typeof departments.list>> | null = null;
  let loadError: string | null = null;

  try {
    data = await departments.list({ pageSize: 100 });
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Departments' },
          ]}
        />

        <PageHeader
          title="Departments"
          description="Company-wide departments with no plant assignment."
          action={
            <a
              href="/administration/departments/new"
              className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New Department
            </a>
          }
        />

        {loadError ? (
          <ErrorState message={loadError} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No departments yet"
            description="Add the first department to get started."
          />
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
                {data.items.map((dept) => (
                  <tr key={dept.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{dept.code}</td>
                    <td className="px-4 py-3 text-text-primary">{dept.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={dept.isActive} isArchived={dept.archivedAt !== null} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <OrgLifecycleActions
                        id={dept.id}
                        code={dept.code}
                        name={dept.name}
                        isActive={dept.isActive}
                        isArchived={dept.archivedAt !== null}
                        editHref={`/administration/departments/${dept.id}/edit`}
                        activateAction={activateDepartmentAction}
                        deactivateAction={deactivateDepartmentAction}
                        archiveAction={archiveDepartmentAction}
                        getDependenciesAction={getDepartmentDependenciesAction}
                        deleteAction={deleteDepartmentAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border text-xs text-text-muted">
              {data.pagination.total} department{data.pagination.total !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
