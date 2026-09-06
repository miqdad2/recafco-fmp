import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import { buildScheduleOverviewCsv } from '../../_lib/contract-schedule-overview-csv';
import { filterOverviewRows, type OverviewFilters } from '../_lib/global-schedule-helpers';
import type { ContractScheduleOverviewStatus } from '@/lib/contracts-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const result = await contractsApi.getContractScheduleOverview().catch(() => null);

  if (!result) {
    return new NextResponse('Schedule overview data unavailable', { status: 502 });
  }

  const filters: OverviewFilters = {
    search: searchParams.get('search') ?? '',
    status: (searchParams.get('status') ?? '') as ContractScheduleOverviewStatus | '',
    team: (searchParams.get('team') ?? '') as OverviewFilters['team'],
    due: (searchParams.get('due') ?? '') as OverviewFilters['due'],
  };
  const today = new Date().toISOString().slice(0, 10);
  const rows = filterOverviewRows(result.rows, filters, today);

  const csv = buildScheduleOverviewCsv(rows);
  const filename = `contract-schedule-overview-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
