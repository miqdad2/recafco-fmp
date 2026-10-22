import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authApi } from '@/lib/auth-api';
import { hasManagementAccess } from '@/lib/management-access';
import { ManagementShell } from './_components/management-shell';

export const metadata: Metadata = { title: 'Management Intelligence — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-MIC-01 — the isolated Management Intelligence workspace. It sits OUTSIDE the (protected)
 * group so it never renders the operational sidebar, and it uses the same session cookies and
 * /auth/me as every other page — there is no second login. Access needs management_intelligence.read;
 * anyone else is sent to the normal landing page (which cannot send them back here, so no loop).
 */
export default async function ManagementLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value;
  if (!accessToken) redirect('/login');

  const me = await authApi.me(accessToken);
  if (!me.ok) redirect('/login');
  if (me.data.mustChangePassword) redirect('/change-password');
  if (!hasManagementAccess(me.data.permissions)) redirect('/dashboard');

  return (
    <ManagementShell displayName={me.data.displayName} roleName={me.data.roleName}>
      {children}
    </ManagementShell>
  );
}
