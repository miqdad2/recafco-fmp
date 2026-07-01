import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { departments, plants, locations } from '@/lib/organizations-api';
import { rolesApi } from '@/lib/roles-api';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { PageHeader } from '../../_components/page-header';
import { UserForm } from '../_components/user-form';
import { createUserAction } from '../actions';

export const metadata: Metadata = { title: 'New User — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function NewUserPage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

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

  return (
    <div className="min-h-full p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/administration' },
            { label: 'Users', href: '/administration/users' },
            { label: 'New' },
          ]}
        />

        <PageHeader
          title="New User"
          description="A temporary password will be generated and shown once."
        />

        <UserForm
          action={createUserAction}
          submitLabel="Create User"
          roles={roleItems}
          departments={deptItems}
          plants={plantItems}
          locations={locItems}
        />
      </div>
    </div>
  );
}
