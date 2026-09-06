import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../_lib/get-user-permissions';
import { buildProductionCsv } from '../../../../_lib/contract-production-csv';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** CM-59 — per-contract Production Status CSV export, mirroring ../../../payments/export/route.ts. */
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id } = await params;
  const detail = await contractsApi.getContractProduction(id).catch(() => null);
  if (!detail) {
    return new NextResponse('Production data unavailable', { status: 502 });
  }

  const csv = buildProductionCsv(detail.items);
  const filename = `contract-production-status-${id}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
