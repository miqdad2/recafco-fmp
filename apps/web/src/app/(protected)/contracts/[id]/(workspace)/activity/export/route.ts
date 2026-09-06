import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../../../_lib/get-user-permissions';
import { buildActivitiesCsv } from '../../../../_lib/contract-activity-csv';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * CM-66 — per-contract Activity / Audit History CSV export, mirroring
 * ../../documents/export/route.ts. Uses the same real, already-existing
 * read endpoint (contractsApi.listActivities()) already backing the table
 * — no new backend endpoint, frontend-only. Never includes raw metadata
 * JSON or internal-only fields.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id } = await params;
  const activities = await contractsApi.listActivities(id).catch(() => null);
  if (!activities) {
    return new NextResponse('Activity data unavailable', { status: 502 });
  }

  const csv = buildActivitiesCsv(activities);
  const filename = `contract-activity-${id}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
