import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../../_lib/get-user-permissions';

export const dynamic = 'force-dynamic';

/**
 * CM-63 — client-fetchable JSON proxy for a document/obligation item's own
 * attachment list — the Add/Edit modal ('use client') can't call
 * contractsApi directly since it depends on next/headers, same reason the
 * variation attachment list has its own proxy route. Department access is
 * re-verified by the API itself on every request.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id, itemId } = await params;
  try {
    const attachments = await contractsApi.listDocumentObligationAttachments(id, itemId);
    return NextResponse.json({ data: attachments });
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : 'Failed to load attachments', { status: 502 });
  }
}
