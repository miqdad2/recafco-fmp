'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/lib/auth-api';

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get('recafco_refresh')?.value;

  // Best-effort: invalidate server session. Clear cookies even if this fails.
  if (refreshToken) {
    await authApi.logout(refreshToken).catch(() => undefined);
  }

  store.delete('recafco_access');
  store.delete('recafco_refresh');

  redirect('/login');
}
