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
import { UserLifecycleActions } from './_components/user-lifecycle-actions';
import { ModuleUserCards } from './_components/module-user-cards';
import { UsersPageTabs, type UsersPageTabKey } from './_components/users-page-tabs';
import { MODULE_CATALOG, moduleBySlug } from './_components/module-catalog';
import { computeModuleUserCounts, type RolePermissionMap } from './_components/module-user-counts';
import { MODULE_READ_PERMISSION } from '../../_lib/module-visibility';
import { activateUserAction, deactivateUserAction, archiveUserAction, deleteTestUserAction } from './actions';

export const metadata: Metadata = { title: 'Users — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    roleCode?: string;
    isActive?: string;
    page?: string;
    module?: string;
    tab?: string;
  }>;
}

export default async function UsersPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const isActiveFilter =
    params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined;
  const moduleFilter = moduleBySlug(params.module);
  // CM-42B — "Create by Module" is the default per spec; only an explicit
  // ?tab=all-users switches to the table view.
  const activeTab: UsersPageTabKey = params.tab === 'all-users' ? 'all-users' : 'modules';

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

  // CM-42 — module cards/filter need each active role's actual permission
  // list (not just its name), same fetch pattern the New User wizard already
  // uses for its own role dropdown. Kept local to this page rather than
  // touching new/page.tsx, so the wizard's existing fetch is untouched.
  const roleDetailResults = await Promise.allSettled(
    roleItems.filter((r) => r.isActive).map((r) => rolesApi.get(accessToken, r.id)),
  );
  const rolePermissions: RolePermissionMap = {};
  roleItems.filter((r) => r.isActive).forEach((r, i) => {
    const res = roleDetailResults[i];
    rolePermissions[r.code] = res?.status === 'fulfilled' && res.value.ok
      ? res.value.data.permissions.map((p) => p.code)
      : [];
  });

  const allFetchedUsers = usersData && usersData.ok ? usersData.data.items : [];
  const moduleUserCounts = computeModuleUserCounts(
    allFetchedUsers.map((u) => ({ roleCode: u.role.code })),
    rolePermissions,
  );

  // Module filter is applied on top of the already-fetched (search/role/status
  // filtered) page of users — frontend-only, no new backend query param: a
  // user "belongs" to a module when their role carries that module's read
  // permission, the same rule module-visibility.ts uses for sidebar access.
  const moduleFilteredUsers = moduleFilter
    ? allFetchedUsers.filter((u) => (rolePermissions[u.role.code] ?? []).includes(MODULE_READ_PERMISSION[moduleFilter.code]))
    : allFetchedUsers;

  const hasFilters = !!(params.search || params.roleCode || params.isActive || params.module);

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

        <UsersPageTabs active={activeTab} />

        {activeTab === 'modules' && <ModuleUserCards counts={moduleUserCounts} />}

        {activeTab === 'all-users' && (
          <>
            <h2 id="all-platform-users" className="text-lg font-semibold text-text-primary mb-1 scroll-mt-6">
              All Platform Users
            </h2>

            {/* Filter bar */}
            <form method="GET" className="mb-6 flex flex-wrap gap-3 items-end">
              {/* Keeps a filter submission (or Clear) on this tab — without this,
                  submitting would produce a URL with no ?tab= at all, which
                  defaults back to "Create by Module". */}
              <input type="hidden" name="tab" value="all-users" />
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
              <div className="min-w-[170px]">
                <label htmlFor="module" className="block text-xs font-medium text-text-secondary mb-1">
                  Module
                </label>
                <select
                  id="module"
                  name="module"
                  defaultValue={params.module ?? ''}
                  className="w-full h-9 px-3 rounded-md border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  <option value="">All modules</option>
                  {MODULE_CATALOG.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name}
                    </option>
                  ))}
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
                    href="/administration/users?tab=all-users"
                    className="inline-flex items-center h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    Clear
                  </Link>
                )}
              </div>
            </form>

            {!usersData || !usersData.ok ? (
              <ErrorState message={usersData?.message ?? 'Failed to load users'} />
            ) : moduleFilteredUsers.length === 0 ? (
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
                    {moduleFilteredUsers.map((user) => (
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
                          <UserLifecycleActions
                            id={user.id}
                            username={user.username}
                            isActive={user.isActive}
                            isArchived={user.archivedAt !== null}
                            isTestUser={user.username.startsWith('test.')}
                            activateAction={activateUserAction}
                            deactivateAction={deactivateUserAction}
                            archiveAction={archiveUserAction}
                            deleteTestUserAction={deleteTestUserAction}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-border text-xs text-text-muted">
                  {/* The module filter is applied client-side on top of the already-fetched
                      page, so its count can only reflect what was fetched — everywhere else
                      (no module filter) keeps showing the backend's accurate total, exactly
                      as before this unit. */}
                  {moduleFilter ? moduleFilteredUsers.length : usersData.data.pagination.total} user
                  {(moduleFilter ? moduleFilteredUsers.length : usersData.data.pagination.total) !== 1 ? 's' : ''}
                  {hasFilters ? ' matching filters' : ''}
                  {moduleFilter ? ` (${moduleFilter.name})` : ''}
                </div>
              </div>
            )}
          </>
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
