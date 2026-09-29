import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

async function getPermissions(): Promise<string[]> {
  try {
    const store = await cookies();
    const token = store.get('recafco_access')?.value;
    if (!token) return [];
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * FMP-INC-01 — streams an incident evidence attachment download through to
 * the browser. Mirrors the exact same proxy shape already established for
 * Contract attachments (e.g. `contracts/[id]/(workspace)/variations/[variationId]/attachments/[attachmentId]/download/route.ts`):
 * a same-origin Next.js Route Handler that forwards the browser's own
 * cookie-based session as a Bearer token to the real API — the browser's
 * `<a href>`/`<img src>` never talks to `API_BASE_URL` directly, so it
 * never needs (and could never hold) the JWT itself. The API itself
 * re-verifies department access and existence on every request; this
 * proxy adds no additional authorization logic beyond the same
 * `incidents.read` gate every other read on an incident already requires.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
): Promise<Response> {
  const permissions = await getPermissions();
  if (!permissions.includes('incidents.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id, attachmentId } = await params;
  const store = await cookies();
  const token = store.get('recafco_access')?.value;

  const apiRes = await fetch(
    `${API_BASE}/incidents/${id}/attachments/${attachmentId}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' },
  );

  if (!apiRes.ok || !apiRes.body) {
    return new NextResponse('Attachment unavailable', { status: apiRes.status || 502 });
  }

  return new NextResponse(apiRes.body, {
    status: 200,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': apiRes.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
