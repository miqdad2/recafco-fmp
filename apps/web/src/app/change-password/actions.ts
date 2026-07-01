'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/lib/auth-api';

export interface ChangePasswordState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function changePasswordAction(
  _prev: ChangePasswordState | null,
  formData: FormData,
): Promise<ChangePasswordState | null> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value;
  if (!accessToken) redirect('/login');

  const currentPassword = formData.get('currentPassword')?.toString() ?? '';
  const newPassword = formData.get('newPassword')?.toString() ?? '';
  const confirmNewPassword = formData.get('confirmNewPassword')?.toString() ?? '';

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return { error: 'All fields are required.' };
  }

  if (newPassword !== confirmNewPassword) {
    return { fieldErrors: { confirmNewPassword: ['Passwords do not match.'] } };
  }

  const result = await authApi.changePassword(accessToken, currentPassword, newPassword);
  if (!result.ok) {
    return { error: result.message };
  }

  // Per correction #10: revoke all sessions → clear cookies → redirect to login.
  store.delete('recafco_access');
  store.delete('recafco_refresh');

  redirect('/login');
}
