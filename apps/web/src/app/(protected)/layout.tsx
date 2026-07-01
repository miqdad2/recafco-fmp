import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/lib/auth-api';
import { rolesApi } from '@/lib/roles-api';
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

  // Resolve live permissions from the role. Falls back to empty array on failure.
  let permissions: string[] = [];
  const roleResult = await rolesApi.get(accessToken, profile.roleId);
  if (roleResult.ok) {
    permissions = roleResult.data.permissions.map((p) => p.code);
  }

  const shellUser: ShellUser = {
    displayName: profile.displayName,
    username: profile.username,
    roleCode: profile.roleCode,
    roleName: profile.roleName,
    permissions,
  };

  return <AppShell user={shellUser}>{children}</AppShell>;
}
