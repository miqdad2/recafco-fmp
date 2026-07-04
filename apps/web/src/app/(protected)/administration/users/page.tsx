import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { usersApi } from '@/lib/users-api';
import { rolesApi } from '@/lib/roles-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PageHeader } from '../_components/page-header';
import { EmptyState } from '../_components/empty-state';
import { ErrorState } from '../_components/error-state';
import { UserSecurityStatus } from './_components/user-security-status';

export const metadata: Metadata = { title: 'Users — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    roleCode?: string;
    isActive?: string;
    page?: string;
  }>;
}

export default async function UsersPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const isActiveFilter =
    params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined;

  const [result, rolesResult] = await Promise.allSettled([
    usersApi.list(accessToken, {
      pageSize: 100,
      ...(params.search ? { search: params.search } : {}),
      ...(params.roleCode ? { roleCode: params.roleCode } : {}),
      ...(isActiveFilter !== undefined ? { isActive: isActiveFilter } : {}),
    }),
    rolesApi.list(accessToken),
  ]);

  const usersData = result.status === 'fulfilled' ? result.value : null;
  const roleItems =
    rolesResult.status === 'fulfilled' && rolesResult.value.ok ? rolesResult.value.data : [];

  const hasFilters = !!(params.search || params.roleCode || params.isActive);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Users' },
          ]}
        />

        <PageHeader
          title="Users"
          description="Manage platform accounts, roles, and module access."
          action={
            <Link
              href="/administration/users/new"
              className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New User
            </Link>
          }
        />

        {/* Filter bar */}
        <form method="GET" className="mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="block text-xs font-medium text-text-secondary mb-1">
              Search
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={params.search ?? ''}
              placeholder="Username or display name…"
              className="w-full h-9 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
          <div className="min-w-[160px]">
            <label htmlFor="roleCode" className="block text-xs font-medium text-text-secondary mb-1">
              Role
            </label>
            <select
              id="roleCode"
              name="roleCode"
              defaultValue={params.roleCode ?? ''}
              className="w-full h-9 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <option value="">All roles</option>
              {roleItems.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label htmlFor="isActive" className="block text-xs font-medium text-text-secondary mb-1">
              Status
            </label>
            <select
              id="isActive"
              name="isActive"
              defaultValue={params.isActive ?? ''}
              className="w-full h-9 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Filter
            </button>
            {hasFilters && (
              <Link
                href="/administration/users"
                className="inline-flex items-center h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        {!usersData || !usersData.ok ? (
          <ErrorState message={usersData?.message ?? 'Failed to load users'} />
        ) : usersData.data.items.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No users match these filters' : 'No users yet'}
            description={
              hasFilters
                ? 'Try adjusting your search or filters.'
                : 'Create the first user account to get started.'
            }
          />
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Display name</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Last login</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersData.data.items.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-text-secondary">{user.username}</span>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{user.displayName}</td>
                    <td className="px-4 py-3">
                      <RoleBadge code={user.role.code} name={user.role.name} />
                    </td>
                    <td className="px-4 py-3">
                      <UserSecurityStatus
                        isActive={user.isActive}
                        isLocked={user.isLocked}
                        mustChangePassword={user.mustChangePassword}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : <span className="text-text-muted italic">Never</span>}
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
              {usersData.data.pagination.total} user
              {usersData.data.pagination.total !== 1 ? 's' : ''}
              {hasFilters ? ' matching filters' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ code, name }: { code: string; name: string }): React.JSX.Element {
  const elevated = code === 'SUPER_ADMIN' || code === 'ADMIN';
  return (
    <span
      className={[
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        elevated ? 'bg-accent/10 text-accent' : 'text-text-muted',
      ].join(' ')}
    >
      {name}
    </span>
  );
}
