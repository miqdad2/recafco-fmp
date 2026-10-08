import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * FMP-BOQ-13 — streams a released drawing / calculation file to a Production
 * user. A same-origin proxy that forwards the session as a Bearer token; the
 * API checks production access, that the piece's group is Released to
 * Production and that the file belongs to that group (the access token carries
 * no permission list, so this adds no authorization logic of its own).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pieceId: string; attachmentId: string }> },
): Promise<Response> {
  const { pieceId, attachmentId } = await params;
  const token = (await cookies()).get('recafco_access')?.value;
  if (!token) return new NextResponse('Please sign in.', { status: 401 });

  const apiRes = await fetch(`${API_BASE}/production/pieces/${pieceId}/drawing-files/${attachmentId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!apiRes.ok || !apiRes.body) {
    const text =
      apiRes.status === 403 ? 'Drawing files are not released to Production yet.' : apiRes.status === 404 ? 'File not found.' : 'Download failed. Please try again.';
    return new NextResponse(text, { status: apiRes.status || 502 });
  }

  return new NextResponse(apiRes.body, {
    status: 200,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': apiRes.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
