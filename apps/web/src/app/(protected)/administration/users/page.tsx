import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { usersApi } from '@/lib/users-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../_components/page-header';
import { StatusBadge } from '../_components/status-badge';
import { EmptyState } from '../_components/empty-state';
import { ErrorState } from '../_components/error-state';

export const metadata: Metadata = { title: 'Users — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function UsersPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const result = await usersApi.list(accessToken, { pageSize: 100 });

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Users' },
          ]}
        />

        <PageHeader
          title="Users"
          description="Manage platform accounts and access roles."
          action={
            <Link
              href="/administration/users/new"
              className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New User
            </Link>
          }
        />

        {!result.ok ? (
          <ErrorState message={result.message} />
        ) : result.data.items.length === 0 ? (
          <EmptyState
            title="No users yet"
            description="Create the first user account to get started."
          />
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Display name</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {user.username}
                      {user.isLocked && (
                        <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-warning-light text-warning">
                          locked
                        </span>
                      )}
                      {user.mustChangePassword && (
                        <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-surface-secondary text-text-muted">
                          pwd
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{user.displayName}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {user.role.code === 'SUPER_ADMIN' || user.role.code === 'ADMIN' ? (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-accent/10 text-accent">
                          {user.role.name}
                        </span>
                      ) : (
                        <span className="text-text-muted">{user.role.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/administration/users/${user.id}/edit`}
                        className="text-xs font-medium text-accent hover:text-accent-hover focus:outline-none focus:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border text-xs text-text-muted">
              {result.data.pagination.total} user{result.data.pagination.total !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
