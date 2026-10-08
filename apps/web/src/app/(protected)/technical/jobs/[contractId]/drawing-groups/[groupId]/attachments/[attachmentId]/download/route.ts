import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * FMP-BOQ-12 — streams a Drawing / Calculation Group file to the browser. A
 * same-origin proxy that forwards the browser's session as a Bearer token; the
 * API itself checks contracts.read, department access and that the file belongs
 * to this contract and group, so this adds no authorization logic of its own
 * (the access token carries no permission list to check here).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string; groupId: string; attachmentId: string }> },
): Promise<Response> {
  const { contractId, groupId, attachmentId } = await params;
  const token = (await cookies()).get('recafco_access')?.value;
  if (!token) return new NextResponse('Please sign in.', { status: 401 });

  const apiRes = await fetch(
    `${API_BASE}/technical/jobs/${contractId}/drawing-groups/${groupId}/attachments/${attachmentId}/download`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );

  if (!apiRes.ok || !apiRes.body) {
    return new NextResponse(apiRes.status === 404 ? 'File not found.' : 'File unavailable.', { status: apiRes.status || 502 });
  }

  return new NextResponse(apiRes.body, {
    status: 200,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': apiRes.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
