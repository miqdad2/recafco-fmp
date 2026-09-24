import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { departments, plants, locations } from '@/lib/organizations-api';
import { rolesApi } from '@/lib/roles-api';
import { authApi } from '@/lib/auth-api';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { PageHeader } from '../../_components/page-header';
import { NewUserWizard } from '../_components/new-user-wizard';
import { createUserWithAccessAction } from '../actions';
import { resolvePermissions } from '../_components/permissions-utils';
import { moduleBySlug } from '../_components/module-catalog';
import { ACCESS_TEMPLATE_VALUES, type AccessTemplate } from '../_components/access-template';

export const metadata: Metadata = { title: 'New User — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ module?: string; template?: string }>;
}

function isKnownAccessTemplate(value: string | undefined): value is AccessTemplate {
  return !!value && (ACCESS_TEMPLATE_VALUES as string[]).includes(value);
}

export default async function NewUserPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  // CM-42 — ?module=<slug> from the Users page's module cards preselects the
  // wizard's Module field (see NewUserWizard's preselectedModule prop).
  // Direct /administration/users/new with no query param behaves exactly as
  // before: moduleBySlug(undefined) is undefined, so the prop is omitted.
  //
  // FMP-UI-02 — a catalog entry may also carry its own presetTemplate (e.g.
  // Erection -> 'ERECTION_MANAGER'), and the Executive / Management card
  // (which has no module at all) links with a standalone ?template=. Either
  // way the value is validated against ACCESS_TEMPLATE_VALUES before being
  // trusted — an unrecognized value is silently ignored, never passed
  // through, since it comes from a URL query string.
  const { module: moduleSlug, template: templateParam } = await searchParams;
  const catalogEntry = moduleBySlug(moduleSlug);
  const preselectedModule = catalogEntry?.code;
  const preselectedModuleLabel = catalogEntry?.name;
  const rawTemplate = catalogEntry?.presetTemplate ?? templateParam;
  const preselectedTemplate = isKnownAccessTemplate(rawTemplate) ? rawTemplate : undefined;

  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const [deptData, plantData, locData, rolesData, meData] =
    await Promise.allSettled([
      departments.list({ isActive: true, pageSize: 100 }),
      plants.list({ isActive: true, pageSize: 100 }),
      locations.list({ isActive: true, pageSize: 100 }),
      rolesApi.list(accessToken),
      authApi.me(accessToken),
    ]);

  const deptItems = deptData.status === 'fulfilled' ? deptData.value.items : [];
  const plantItems = plantData.status === 'fulfilled' ? plantData.value.items : [];
  const locItems = locData.status === 'fulfilled' ? locData.value.items : [];
  const deptApiError = deptData.status === 'rejected';
  const plantApiError = plantData.status === 'rejected';
  const locApiError = locData.status === 'rejected';
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

        <NewUserWizard
          action={createUserWithAccessAction}
          roles={rolesWithPerms}
          departments={deptItems}
          plants={plantItems}
          locations={locItems}
          canManageAll={canManageAll}
          deptApiError={deptApiError}
          plantApiError={plantApiError}
          locApiError={locApiError}
          {...(preselectedModule ? { preselectedModule } : {})}
          {...(preselectedModuleLabel ? { preselectedModuleLabel } : {})}
          {...(preselectedTemplate ? { preselectedTemplate } : {})}
        />
      </div>
    </div>
  );
}
