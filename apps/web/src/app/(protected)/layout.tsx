import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/lib/auth-api';
import { MANAGEMENT_HOME_PATH, isManagementOnlyAccess } from '@/lib/management-access';
import { AppShell } from './_components/app-shell';
import type { ShellUser } from './_components/app-shell';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  const meResult = await authApi.me(accessToken);

  if (!meResult.ok) {
    redirect('/login');
  }

  const profile = meResult.data;

  if (profile.mustChangePassword) {
    redirect('/change-password');
  }

  // FMP-MIC-01 — a management-only account never enters the operational shell: every route under
  // (protected) is operational, so a direct URL, refresh or restored session is sent to the
  // Management Intelligence Center. The management layout lives outside this group, so no loop.
  if (isManagementOnlyAccess(profile.permissions, profile.fullPlatformAccess === true)) {
    redirect(MANAGEMENT_HOME_PATH);
  }

  const shellUser: ShellUser = {
    displayName: profile.displayName,
    username: profile.username,
    roleCode: profile.roleCode,
    roleName: profile.roleName,
    permissions: profile.permissions,
    fullPlatformAccess: profile.fullPlatformAccess === true,
  };

  return <AppShell user={shellUser}>{children}</AppShell>;
}
