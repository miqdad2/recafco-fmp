import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserPermissions } from '../../../../../../../../../../_lib/get-user-permissions';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * Streams an Erection Method Statement Approval (Step 2) review attachment
 * download through to the browser. Department access is re-verified by the
 * API itself on every request — this proxy adds no additional authorization
 * logic, matching the Step 1 / variation attachment download routes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; approvalId: string; attachmentId: string }> },
): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id, approvalId, attachmentId } = await params;
  const store = await cookies();
  const token = store.get('recafco_access')?.value;

  const apiRes = await fetch(
    `${API_BASE}/contracts/${id}/erection/method-statement/approval/${approvalId}/attachments/${attachmentId}/download`,
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
