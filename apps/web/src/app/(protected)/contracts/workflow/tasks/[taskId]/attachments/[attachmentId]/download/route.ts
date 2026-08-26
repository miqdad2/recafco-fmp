import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserPermissions } from '@/app/(protected)/contracts/_lib/get-user-permissions';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * Streams an attachment download through to the browser. Department access
 * is re-verified by the API itself (via the parent task's contract) on every
 * request — this proxy adds no additional authorization logic, it only
 * forwards the browser's cookie-based session as a Bearer token, matching
 * every other server-to-API call in this app.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string; attachmentId: string }> },
): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { taskId, attachmentId } = await params;
  const store = await cookies();
  const token = store.get('recafco_access')?.value;

  const apiRes = await fetch(
    `${API_BASE}/contracts/workflow/tasks/${taskId}/attachments/${attachmentId}/download`,
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
