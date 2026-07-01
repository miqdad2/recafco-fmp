import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { usersApi } from '@/lib/users-api';
import { departments, plants, locations } from '@/lib/organizations-api';
import { rolesApi } from '@/lib/roles-api';
import { Breadcrumbs } from '../../../../_components/breadcrumbs';
import { PageHeader } from '../../../_components/page-header';
import { StatusBadge } from '../../../_components/status-badge';
import { UserForm } from '../../_components/user-form';
import { ResetPasswordForm } from '../../_components/reset-password-form';
import {
  updateUserAction,
  resetPasswordAction,
  deactivateUserAction,
  activateUserAction,
  unlockUserAction,
} from '../../actions';

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

  const [deptData, plantData, locData, rolesData] = await Promise.allSettled([
    departments.list({ isActive: true, pageSize: 200 }),
    plants.list({ isActive: true, pageSize: 200 }),
    locations.list({ isActive: true, pageSize: 200 }),
    rolesApi.list(accessToken),
  ]);

  const deptItems = deptData.status === 'fulfilled' ? deptData.value.items : [];
  const plantItems = plantData.status === 'fulfilled' ? plantData.value.items : [];
  const locItems = locData.status === 'fulfilled' ? locData.value.items : [];
  const roleItems =
    rolesData.status === 'fulfilled' && rolesData.value.ok ? rolesData.value.data : [];

  const updateAction = updateUserAction.bind(null, id);
  const resetAction = resetPasswordAction.bind(null, id);
  const deactivateAction = deactivateUserAction.bind(null, id);
  const activateAction = activateUserAction.bind(null, id);
  const unlockAction = unlockUserAction.bind(null, id);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Users', href: '/administration/users' },
            { label: 'Edit' },
          ]}
        />

        <PageHeader title={`Edit User: ${user.username}`} />

        <div className="flex items-center gap-2 -mt-4 mb-6">
          <StatusBadge isActive={user.isActive} />
          {user.isLocked && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-warning-light text-warning">
              Account locked
            </span>
          )}
          {user.mustChangePassword && (
            <span className="text-text-muted text-xs">Password change required</span>
          )}
        </div>

        <UserForm
          action={updateAction}
          submitLabel="Save Changes"
          isEdit
          defaultValues={{
            username: user.username,
            displayName: user.displayName,
            ...(user.email !== null ? { email: user.email } : {}),
            ...(user.employeeNumber !== null ? { employeeNumber: user.employeeNumber } : {}),
            roleId: user.roleId,
            ...(user.departmentId !== null ? { departmentId: user.departmentId } : {}),
            ...(user.plantId !== null ? { plantId: user.plantId } : {}),
            ...(user.locationId !== null ? { locationId: user.locationId } : {}),
          }}
          roles={roleItems}
          departments={deptItems}
          plants={plantItems}
          locations={locItems}
        />

        <div className="mt-8 pt-6 border-t border-border space-y-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Account actions
          </h3>

          <div className="flex flex-wrap gap-3 items-start">
            <ResetPasswordForm action={resetAction} />

            {user.isLocked && (
              <form action={unlockAction}>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Unlock account
                </button>
              </form>
            )}

            {user.isActive ? (
              <form action={deactivateAction}>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-md border border-error bg-error-light text-error text-sm hover:bg-error/20 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Deactivate account
                </button>
              </form>
            ) : (
              <form action={activateAction}>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-md border border-border bg-surface text-text-primary text-sm hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  Activate account
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
