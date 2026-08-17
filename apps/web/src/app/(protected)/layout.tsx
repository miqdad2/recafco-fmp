import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/lib/auth-api';
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

  const shellUser: ShellUser = {
    displayName: profile.displayName,
    username: profile.username,
    roleCode: profile.roleCode,
    roleName: profile.roleName,
    permissions: profile.permissions,
  };

  return <AppShell user={shellUser}>{children}</AppShell>;
}
