import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * FMP-TECH-27 — streams an element's own final drawing file (open). A same-origin proxy that forwards the
 * browser's session; the API checks read permission, department access and that the file belongs to this
 * element and job, so no authorization logic is added here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string; pieceId: string; attachmentId: string }> },
): Promise<Response> {
  const { contractId, pieceId, attachmentId } = await params;
  const token = (await cookies()).get('recafco_access')?.value;
  if (!token) return new NextResponse('Please sign in.', { status: 401 });

  const apiRes = await fetch(
    `${API_BASE}/technical/jobs/${contractId}/element-drawings/${pieceId}/files/${attachmentId}/view`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!apiRes.ok || !apiRes.body) {
    return new NextResponse(apiRes.status === 404 ? 'File not found.' : 'File unavailable.', { status: apiRes.status || 502 });
  }
  return new NextResponse(apiRes.body, {
    status: 200,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': apiRes.headers.get('content-disposition') ?? 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
