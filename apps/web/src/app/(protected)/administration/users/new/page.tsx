import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { departments, plants, locations } from '@/lib/organizations-api';
import { rolesApi } from '@/lib/roles-api';
import { authApi } from '@/lib/auth-api';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { PageHeader } from '../../_components/page-header';
import { NewUserForm } from '../_components/new-user-form';
import { createUserWithAccessAction } from '../actions';
import { resolvePermissions } from '../_components/permissions-utils';

export const metadata: Metadata = { title: 'New User — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function NewUserPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [deptData, plantData, locData, rolesData, meData] =
    await Promise.allSettled([
      departments.list({ isActive: true, pageSize: 200 }),
      plants.list({ isActive: true, pageSize: 200 }),
      locations.list({ isActive: true, pageSize: 200 }),
      rolesApi.list(accessToken),
      authApi.me(accessToken),
    ]);

  const deptItems = deptData.status === 'fulfilled' ? deptData.value.items : [];
  const plantItems = plantData.status === 'fulfilled' ? plantData.value.items : [];
  const locItems = locData.status === 'fulfilled' ? locData.value.items : [];
  const roleList =
    rolesData.status === 'fulfilled' && rolesData.value.ok ? rolesData.value.data : [];

  const currentUser = meData.status === 'fulfilled' && meData.value.ok ? meData.value.data : null;
  const permissions = resolvePermissions(currentUser?.permissions);
  const canManageAll = permissions.includes('access_scope.manage_all_departments');

  // Fetch full role details (with permissions) for each active role.
  const roleDetailResults = await Promise.allSettled(
    roleList.filter((r) => r.isActive).map((r) => rolesApi.get(accessToken, r.id)),
  );

  const rolesWithPerms = roleDetailResults
    .map((res, i) => {
      const role = roleList.filter((r) => r.isActive)[i]!;
      const perms = res.status === 'fulfilled' && res.value.ok ? res.value.data.permissions : [];
      return { ...role, permissions: perms };
    });

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Users', href: '/administration/users' },
            { label: 'New User' },
          ]}
        />

        <PageHeader
          title="New User"
          description="A temporary password will be generated and shown once after creation."
        />

        <NewUserForm
          action={createUserWithAccessAction}
          roles={rolesWithPerms}
          departments={deptItems}
          plants={plantItems}
          locations={locItems}
          canManageAll={canManageAll}
        />
      </div>
    </div>
  );
}
