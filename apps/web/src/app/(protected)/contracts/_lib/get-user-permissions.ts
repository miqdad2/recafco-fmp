import { cookies } from 'next/headers';
import { authApi } from '@/lib/auth-api';

/**
 * The access-token JWT intentionally carries no `permissions` claim (see
 * apps/api/src/auth/types/jwt-payload.ts) — the backend always re-derives
 * authorization from the live DB on every request. Real permissions must
 * come from the API: /auth/me already returns the actor's full permission
 * list (backend recomputes it via JwtAuthGuard per request), so a single
 * call is enough. Decoding the JWT cookie directly always yields `[]`.
 *
 * Shared across all Contract Management server pages/layouts that need the
 * current user's permissions — do not reintroduce a local JWT-decode copy.
 */
export async function getUserPermissions(): Promise<string[]> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value;
  if (!accessToken) return [];

  const meResult = await authApi.me(accessToken);
  return meResult.ok ? meResult.data.permissions : [];
}

/**
 * CM-35 — pages that need to tell "assigned to me" apart from "assigned to
 * someone else" (e.g. the Workflow board, where Contract Staff may only edit
 * their own tasks) need the actor's id alongside their permissions. Same
 * /auth/me call as getUserPermissions() above, just returning one more field.
 */
export async function getCurrentUserContext(): Promise<{ id: string | null; permissions: string[] }> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value;
  if (!accessToken) return { id: null, permissions: [] };

  const meResult = await authApi.me(accessToken);
  return meResult.ok ? { id: meResult.data.id, permissions: meResult.data.permissions } : { id: null, permissions: [] };
}
