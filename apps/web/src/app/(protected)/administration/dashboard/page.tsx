import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  UserX,
  Lock,
  KeyRound,
} from 'lucide-react';
import { usersApi } from '@/lib/users-api';
import type { AdminDashboardData } from '@/lib/users-api';
import { authApi } from '@/lib/auth-api';
import { MetricCard } from '../../_components/metric-card';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../_components/dashboard-scope-badge';
import { DashboardRecentTable } from '../../_components/dashboard-recent-table';

export const metadata: Metadata = { title: 'Administration Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function AdministrationDashboardPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [dashboardResult, meResult] = await Promise.allSettled([
    usersApi.dashboard(accessToken),
    authApi.me(accessToken),
  ]);

  let data: AdminDashboardData | null = null;
  if (dashboardResult.status === 'fulfilled' && dashboardResult.value.ok) {
    data = dashboardResult.value.data;
  }
  const permissions: string[] =
    meResult.status === 'fulfilled' && meResult.value.ok
      ? meResult.value.data.permissions
      : [];

  const m = data?.metrics;
  const s = data ? 'ok' : 'unavailable' as const;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <Breadcrumbs
        items={[
          { label: 'Administration', href: '/administration/dashboard' },
          { label: 'Dashboard' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Administration</h1>
          <p className="mt-1 text-sm text-text-secondary">
            User management and platform administration
          </p>
        </div>
        <DashboardScopeBadge scope={data?.scope} />
      </div>

      {!data && (
        <div className="rounded-md bg-error-light border border-error px-4 py-3 text-sm text-error">
          Dashboard data unavailable. The API may be offline or you may not have access.
        </div>
      )}

      <section aria-labelledby="admin-metrics-heading">
        <h2
          id="admin-metrics-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          User Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Active Users"
            value={m?.totalActiveUsers}
            icon={Users}
            iconColor="text-success"
            href="/administration/users?isActive=true"
            status={s}
          />
          <MetricCard
            label="Inactive Users"
            value={m?.totalInactiveUsers}
            icon={UserX}
            iconColor="text-text-muted"
            href="/administration/users?isActive=false"
            status={s}
          />
          <MetricCard
            label="Locked Accounts"
            value={m?.totalLockedUsers}
            icon={Lock}
            iconColor="text-warning"
            href="/administration/users"
            status={s}
          />
          <MetricCard
            label="Must Change Password"
            value={m?.mustChangePassword}
            icon={KeyRound}
            iconColor="text-info"
            href="/administration/users"
            status={s}
          />
        </div>
      </section>

      <section aria-labelledby="admin-recent-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="admin-recent-heading"
            className="text-sm font-semibold text-text-secondary uppercase tracking-wide"
          >
            Recent Users
          </h2>
          <Link href="/administration/users" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <DashboardRecentTable
          items={data?.recent ?? []}
          baseHref="/administration/users"
          hrefSuffix="/edit"
          emptyMessage="No users found."
        />
      </section>

      <section aria-labelledby="admin-actions-heading">
        <h2
          id="admin-actions-heading"
          className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3"
        >
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {permissions.includes('users.create') && (
            <Link
              href="/administration/users/new"
              className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus"
            >
              New User
            </Link>
          )}
          <Link
            href="/administration/users"
            className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            All Users
          </Link>
          {permissions.includes('roles.read') && (
            <Link
              href="/administration/roles"
              className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Roles
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
