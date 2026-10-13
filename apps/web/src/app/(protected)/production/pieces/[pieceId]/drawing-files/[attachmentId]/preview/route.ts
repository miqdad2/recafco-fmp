import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

/**
 * FMP-PROD-03 — PNG preview of a TIFF drawing, for the Production drawing viewer only (browsers cannot show
 * TIFF). The original file is never changed; Download still serves it. Same-origin proxy, the API does the checks.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pieceId: string; attachmentId: string }> },
): Promise<Response> {
  const { pieceId, attachmentId } = await params;
  const token = (await cookies()).get('recafco_access')?.value;
  if (!token) return new NextResponse('Please sign in.', { status: 401 });

  const apiRes = await fetch(`${API_BASE}/production/pieces/${pieceId}/drawing-files/${attachmentId}/preview`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!apiRes.ok || !apiRes.body) {
    return new NextResponse(apiRes.status === 404 ? 'File not found.' : 'Preview unavailable.', { status: apiRes.status || 502 });
  }

  return new NextResponse(apiRes.body, {
    status: 200,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'image/png',
      'Content-Disposition': apiRes.headers.get('content-disposition') ?? 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
