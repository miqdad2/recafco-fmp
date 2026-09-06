import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../_lib/get-user-permissions';
import { buildRisksCsv } from '../../../../_lib/contract-risk-csv';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** CM-62 — per-contract Risk Assessment CSV export, mirroring ../../variations/export/route.ts. */
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id } = await params;
  const detail = await contractsApi.getContractRisks(id).catch(() => null);
  if (!detail) {
    return new NextResponse('Risk Assessment data unavailable', { status: 502 });
  }

  const csv = buildRisksCsv(detail.items);
  const filename = `contract-risks-${id}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
