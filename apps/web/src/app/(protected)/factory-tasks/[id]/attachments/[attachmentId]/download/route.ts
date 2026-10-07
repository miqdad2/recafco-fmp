import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * FMP-TASK-05 - streams a task attachment download to the browser. Same
 * same-origin proxy shape as the incident evidence download route: the
 * browser's cookie session is forwarded as a Bearer token; the API
 * re-verifies permission and department access on every request.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
): Promise<Response> {
  const { id, attachmentId } = await params;
  const store = await cookies();
  const token = store.get('recafco_access')?.value;
  if (!token) return new NextResponse('Forbidden', { status: 403 });

  const apiRes = await fetch(`${API_BASE}/factory-tasks/${id}/attachments/${attachmentId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
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
