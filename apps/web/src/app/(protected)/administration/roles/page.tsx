import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import type { RoleSummary } from '@/lib/roles-api';
import { rolesApi } from '@/lib/roles-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../_components/page-header';
import { StatusBadge } from '../_components/status-badge';
import { EmptyState } from '../_components/empty-state';
import { ErrorState } from '../_components/error-state';

export const metadata: Metadata = { title: 'Roles — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function RolesPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const result = await rolesApi.list(accessToken);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Roles' },
          ]}
        />

        <PageHeader
          title="Roles"
          description="System and custom roles with their assigned permission sets."
        />

        {!result.ok ? (
          <ErrorState message={result.message} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title="No roles found"
            description="Run the bootstrap migration to seed system roles."
          />
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((role: RoleSummary) => (
                  <tr key={role.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{role.code}</td>
                    <td className="px-4 py-3 text-text-primary font-medium">{role.name}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs max-w-xs">
                      {role.description ?? <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {role.isSystem ? (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-accent/10 text-accent">
                          System
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">Custom</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={role.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border text-xs text-text-muted">
              {result.data.length} role{result.data.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
