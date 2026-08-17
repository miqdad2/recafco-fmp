'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/lib/auth-api';

export interface ChangePasswordState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const MIN_PASSWORD_LENGTH = 3;

/** Maps known backend error codes to clear, user-friendly text. Falls back to the backend's own message for anything else — never invents a state the backend didn't report. */
function friendlyChangePasswordError(result: { code: string; message: string }): string {
  if (result.code === 'INVALID_CREDENTIALS') return 'Current password is incorrect.';
  if (result.code === 'VALIDATION_ERROR') return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return result.message;
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

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      fieldErrors: { newPassword: [`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`] },
    };
  }

  if (newPassword !== confirmNewPassword) {
    return { fieldErrors: { confirmNewPassword: ['New password and confirm password do not match.'] } };
  }

  const result = await authApi.changePassword(accessToken, currentPassword, newPassword);
  if (!result.ok) {
    return { error: friendlyChangePasswordError(result) };
  }

  // Per correction #10: revoke all sessions → clear cookies → redirect to login.
  store.delete('recafco_access');
  store.delete('recafco_refresh');

  redirect('/login');
}
