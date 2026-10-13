import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { BOQ_FILE_TEXT } from './boq-attachment-helpers';

// ---------------------------------------------------------------------------
// FMP-BOQ-17 — server-only helpers shared by the BOQ file routes and by the
// upload actions (Technical's own page and New Contract Register).
// ---------------------------------------------------------------------------

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

async function accessToken(): Promise<string | undefined> {
  try {
    return (await cookies()).get('recafco_access')?.value;
  } catch {
    return undefined;
  }
}

/** Uploads one file to one BOQ item. Returns a plain message on failure; never throws. */
export async function uploadBoqItemFile(
  contractId: string,
  boqItemId: string,
  file: File,
): Promise<{ error: string | null }> {
  try {
    const token = await accessToken();
    const body = new FormData();
    body.append('boqItemId', boqItemId);
    body.append('file', file, file.name);
    const res = await fetch(`${API_BASE}/technical/jobs/${contractId}/boq-attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
      cache: 'no-store',
    });
    if (res.ok) return { error: null };
    let message: string = BOQ_FILE_TEXT.uploadFailed;
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      message = json.error?.message ?? message;
    } catch {
      // keep the friendly default
    }
    return { error: `${file.name}: ${message}` };
  } catch {
    return { error: `${file.name}: ${BOQ_FILE_TEXT.uploadFailed}` };
  }
}

/**
 * Streams a BOQ file through to the browser. The API re-checks permission and
 * department access on every request (the access token carries no permissions, so
 * nothing is decided here); this only forwards the user's own session.
 */
export async function proxyBoqAttachment(
  contractId: string,
  attachmentId: string,
  mode: 'download' | 'view' | 'preview',
): Promise<Response> {
  const token = await accessToken();
  const apiRes = await fetch(`${API_BASE}/technical/jobs/${contractId}/boq-attachments/${attachmentId}/${mode}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!apiRes.ok || !apiRes.body) {
    return new NextResponse('File unavailable', { status: apiRes.status || 502 });
  }
  return new NextResponse(apiRes.body, {
    status: 200,
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': apiRes.headers.get('content-disposition') ?? (mode === 'download' ? 'attachment' : 'inline'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
