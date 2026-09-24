import { NextResponse, type NextRequest } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';
const LOGIN_PATH = '/login';
const CHANGE_PASSWORD_PATH = '/change-password';

// Paths that do not require authentication.
// FMP-UI-11-fix — `/recafco-logo.png` (apps/web/public/) and `/icon.png`
// (Next's app/icon.png auto-generated favicon route) were never added here
// when the logo was introduced, so an unauthenticated request for either
// (e.g. the <img> on the login page itself, or the browser tab favicon)
// fell through to the auth check below and got redirected to /login —
// returning an HTML page instead of image bytes, which is why the logo
// rendered as a broken image on /login. Any future public static asset
// added outside `_next/` needs a matching entry here.
const PUBLIC_PREFIXES = [LOGIN_PATH, '/_next', '/favicon.ico', '/api/health', '/recafco-logo.png', '/icon.png'];

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
const COOKIE_SECURE =
  IS_PROD && process.env['AUTH_COOKIE_SECURE'] !== 'false';

const COOKIE_BASE = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
};

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

// CM-71H.3 — Server Components (e.g. the contract workspace layout) have no
// built-in way to read the current request's pathname; middleware is the
// only place it's directly available. Forwarding it as a request header
// (the standard Next.js App Router pattern) lets a layout make a routing
// decision — e.g. "this sub-route is exempt from a redirect that applies to
// every other sub-route" — without needing the pathname threaded through
// params, which only ever carries the dynamic segments ([id]), never the
// full path.
function nextWithPathname(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;

  // Pass public paths through without auth check.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return nextWithPathname(request);
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

    const res = nextWithPathname(request);
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

  return nextWithPathname(request);
};

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
