import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { usersApi } from '@/lib/users-api';
import { authApi } from '@/lib/auth-api';
import { departments, plants, locations } from '@/lib/organizations-api';
import { rolesApi } from '@/lib/roles-api';
import { Breadcrumbs } from '../../../../_components/breadcrumbs';
import { PageHeader } from '../../../_components/page-header';
import { EditUserTabs } from '../../_components/edit-user-tabs';
import {
  resetPasswordAction,
  deactivateUserAction,
  activateUserAction,
  unlockUserAction,
  setModuleAccessAction,
  updateProfileAction,
  updateOrgAction,
  assignRoleAction,
} from '../../actions';
import { resolvePermissions } from '../../_components/permissions-utils';

export const metadata: Metadata = { title: 'Edit User — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: Props): Promise<React.JSX.Element> {
  const { id } = await params;

  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const userResult = await usersApi.get(accessToken, id);
  if (!userResult.ok) notFound();

  const user = userResult.data;

  const [deptData, plantData, locData, rolesData, moduleAccessData, meData] =
    await Promise.allSettled([
      departments.list({ isActive: true, pageSize: 200 }),
      plants.list({ isActive: true, pageSize: 200 }),
      locations.list({ isActive: true, pageSize: 200 }),
      rolesApi.list(accessToken),
      usersApi.getModuleAccess(accessToken, id),
      authApi.me(accessToken),
    ]);

  const deptItems = deptData.status === 'fulfilled' ? deptData.value.items : [];
  const plantItems = plantData.status === 'fulfilled' ? plantData.value.items : [];
  const locItems = locData.status === 'fulfilled' ? locData.value.items : [];
  const roleList =
    rolesData.status === 'fulfilled' && rolesData.value.ok ? rolesData.value.data : [];

  const moduleAccess =
    moduleAccessData.status === 'fulfilled' && moduleAccessData.value.ok
      ? moduleAccessData.value.data
      : null;

  const currentUser = meData.status === 'fulfilled' && meData.value.ok ? meData.value.data : null;
  const permissions = resolvePermissions(currentUser?.permissions);
  const canManageAccess = permissions.includes('access_scope.manage');
  const canManageAll = permissions.includes('access_scope.manage_all_departments');

  // Fetch full role details (with permissions) for active roles + user's current role.
  const rolesToFetch = roleList.filter((r) => r.isActive || r.id === user.roleId);
  const roleDetailResults = await Promise.allSettled(
    rolesToFetch.map((r) => rolesApi.get(accessToken, r.id)),
  );
  const rolesWithPerms = roleDetailResults.map((res, i) => {
    const role = rolesToFetch[i]!;
    const perms = res.status === 'fulfilled' && res.value.ok ? res.value.data.permissions : [];
    return { ...role, permissions: perms };
  });

  // Bind actions to this user's ID.
  const updateProfileBound = updateProfileAction.bind(null, id);
  const updateOrgBound = updateOrgAction.bind(null, id);
  const assignRoleBound = assignRoleAction.bind(null, id);
  const resetPasswordBound = resetPasswordAction.bind(null, id);
  const deactivateBound = deactivateUserAction.bind(null, id);
  const activateBound = activateUserAction.bind(null, id);
  const unlockBound = unlockUserAction.bind(null, id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Users', href: '/administration/users' },
            { label: user.username },
          ]}
        />

        <PageHeader title={`Edit User: ${user.username}`} />

        <EditUserTabs
          user={user}
          roles={rolesWithPerms}
          departments={deptItems}
          plants={plantItems}
          locations={locItems}
          moduleAccess={moduleAccess}
          canManageAccess={canManageAccess}
          canManageAll={canManageAll}
          updateProfileAction={updateProfileBound}
          updateOrgAction={updateOrgBound}
          assignRoleAction={assignRoleBound}
          resetPasswordActionBound={resetPasswordBound}
          deactivateAction={deactivateBound}
          activateAction={activateBound}
          unlockAction={unlockBound}
          setModuleAccessAction={setModuleAccessAction}
        />
      </div>
    </div>
  );
}
