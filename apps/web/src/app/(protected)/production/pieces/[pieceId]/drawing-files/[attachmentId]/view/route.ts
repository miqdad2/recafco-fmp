import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * FMP-PROD-03 — streams a final drawing file to the Production drawing viewer, inline (not as a download).
 * A same-origin proxy that forwards the session as a Bearer token; the API checks production access and
 * that the file belongs to the element (its released group, or the element itself), so this adds no
 * authorization logic of its own.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pieceId: string; attachmentId: string }> },
): Promise<Response> {
  const { pieceId, attachmentId } = await params;
  const token = (await cookies()).get('recafco_access')?.value;
  if (!token) return new NextResponse('Please sign in.', { status: 401 });

  const apiRes = await fetch(`${API_BASE}/production/pieces/${pieceId}/drawing-files/${attachmentId}/view`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!apiRes.ok || !apiRes.body) {
    const text =
      apiRes.status === 403 ? 'Drawing files are not released to Production yet.' : apiRes.status === 404 ? 'File not found.' : 'File unavailable.';
    return new NextResponse(text, { status: apiRes.status || 502 });
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
