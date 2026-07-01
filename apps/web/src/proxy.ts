import { NextResponse, type NextRequest } from 'next/server';
import type { NextProxy, ProxyConfig } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';
const LOGIN_PATH = '/login';
const CHANGE_PASSWORD_PATH = '/change-password';

// Paths that do not require authentication.
const PUBLIC_PREFIXES = [LOGIN_PATH, '/_next', '/favicon.ico', '/api/health'];

// Parse JWT payload without signature verification (navigation use only).
// Authorization is enforced by JwtAuthGuard in NestJS on every API call.
function parseJwtPayload(token: string): { exp?: number; mustChangePassword?: boolean } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as { exp?: number; mustChangePassword?: boolean };
  } catch {
    return null;
  }
}

function isTokenExpired(payload: { exp?: number }): boolean {
  if (!payload.exp) return true;
  // Add 10-second buffer to avoid edge cases near expiry.
  return payload.exp * 1000 < Date.now() + 10_000;
}

async function tryRefresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { accessToken: string; refreshToken: string } };
    if (!body.data?.accessToken || !body.data.refreshToken) return null;
    return body.data;
  } catch {
    return null;
  }
}

const IS_PROD = process.env['NODE_ENV'] === 'production';
const COOKIE_BASE = { httpOnly: true, secure: IS_PROD, sameSite: 'strict' as const, path: '/' };

function setTokenCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookies.set('recafco_access', accessToken, { ...COOKIE_BASE, maxAge: 900 });
  res.cookies.set('recafco_refresh', refreshToken, { ...COOKIE_BASE, maxAge: 7 * 24 * 3600 });
}

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
}

export const proxy: NextProxy = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;

  // Pass public paths through without auth check.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('recafco_access')?.value;
  const refreshToken = request.cookies.get('recafco_refresh')?.value;

  // No tokens at all → login.
  if (!accessToken && !refreshToken) {
    return redirectToLogin(request);
  }

  // Attempt refresh when no access token or access token is expired.
  if (!accessToken || !parseJwtPayload(accessToken) || isTokenExpired(parseJwtPayload(accessToken)!)) {
    if (!refreshToken) return redirectToLogin(request);

    const refreshed = await tryRefresh(refreshToken);
    if (!refreshed) return redirectToLogin(request);

    const newPayload = parseJwtPayload(refreshed.accessToken);
    if (!newPayload) return redirectToLogin(request);

    const res = NextResponse.next();
    setTokenCookies(res, refreshed.accessToken, refreshed.refreshToken);

    // Check mustChangePassword after refresh.
    if (newPayload.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
    }

    return res;
  }

  const payload = parseJwtPayload(accessToken)!;

  // Force password change (navigation guard; enforcement is also in NestJS JwtAuthGuard).
  if (payload.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
  }

  return NextResponse.next();
};

export const config: ProxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
