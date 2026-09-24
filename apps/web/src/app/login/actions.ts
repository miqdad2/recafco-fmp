'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/lib/auth-api';

export interface LoginState {
  error?: string;
}

const IS_PROD = process.env['NODE_ENV'] === 'production';
const COOKIE_SECURE =
  IS_PROD && process.env['AUTH_COOKIE_SECURE'] !== 'false';

const COOKIE_BASE = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
};

export async function loginAction(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState | null> {
  const username = formData.get('username')?.toString().trim() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  const result = await authApi.login(username, password);
  if (!result.ok) {
    return { error: result.message };
  }

  const { accessToken, refreshToken, mustChangePassword } = result.data;
  const store = await cookies();
  store.set('recafco_access', accessToken, { ...COOKIE_BASE, maxAge: 900 });
  store.set('recafco_refresh', refreshToken, { ...COOKIE_BASE, maxAge: 7 * 24 * 3600 });

  // FMP-UI-Login-Polish — a normal successful login now lands on the short
  // branded welcome transition first (was straight to '/', which itself
  // just redirects to '/dashboard'), which then continues on to '/' itself
  // once the transition finishes. Everything above this line — credential
  // check, cookie names/flags/maxAge — is unchanged; only this destination
  // string differs. mustChangePassword still goes straight to
  // /change-password, unaffected — showing a "welcome to your workspace"
  // screen before that would be misleading.
  const destination = mustChangePassword ? '/change-password' : '/welcome';
  redirect(destination);
}
