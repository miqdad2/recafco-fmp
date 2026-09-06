import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../_lib/get-user-permissions';
import { buildAttachmentsCsv } from '../../../../_lib/contract-attachment-csv';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * CM-64 — per-contract Attachments / Document Library CSV export, mirroring
 * ../../documents/export/route.ts. Uses the same real aggregation
 * (contractsApi.getContractAttachments()) already backing the table — no
 * new backend endpoint, frontend-only. Never includes a raw storage path.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id } = await params;
  const attachments = await contractsApi.getContractAttachments(id).catch(() => null);
  if (!attachments) {
    return new NextResponse('Attachments data unavailable', { status: 502 });
  }

  const csv = buildAttachmentsCsv(attachments);
  const filename = `contract-attachments-${id}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
