import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { canReadTechnical } from '@/app/(protected)/technical/_lib/technical-permissions';

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
 * FMP-TECH-03 — streams a Getting Approval attachment download through to
 * the browser. Mirrors the exact same proxy shape as the Drawing Received /
 * SD & Calculation Submission attachment download routes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string; attachmentId: string }> },
): Promise<Response> {
  const permissions = await getPermissions();
  if (!canReadTechnical(permissions)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { contractId, attachmentId } = await params;
  const store = await cookies();
  const token = store.get('recafco_access')?.value;

  const apiRes = await fetch(
    `${API_BASE}/technical/jobs/${contractId}/getting-approval/attachments/${attachmentId}/download`,
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
