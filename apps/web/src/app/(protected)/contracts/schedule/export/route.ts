import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import { buildScheduleCsv } from '../../_lib/contract-schedule-csv';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const overdueOnlyRaw = searchParams.get('overdueOnly');
  const upcomingOnlyRaw = searchParams.get('upcomingOnly');

  const result = await contractsApi.listSchedule({
    page: 1,
    pageSize: 500,
    ...(searchParams.get('search') ? { search: searchParams.get('search') as string } : {}),
    ...(searchParams.get('contractId') ? { contractId: searchParams.get('contractId') as string } : {}),
    ...(searchParams.get('itemType') ? { itemType: searchParams.get('itemType') as string } : {}),
    ...(searchParams.get('status') ? { status: searchParams.get('status') as string } : {}),
    ...(searchParams.get('departmentId') ? { departmentId: searchParams.get('departmentId') as string } : {}),
    ...(searchParams.get('responsibleUserId') ? { responsibleUserId: searchParams.get('responsibleUserId') as string } : {}),
    ...(searchParams.get('ownerUserId') ? { ownerUserId: searchParams.get('ownerUserId') as string } : {}),
    ...(searchParams.get('dateFrom') ? { dateFrom: searchParams.get('dateFrom') as string } : {}),
    ...(searchParams.get('dateTo') ? { dateTo: searchParams.get('dateTo') as string } : {}),
    ...(overdueOnlyRaw === 'true' ? { overdueOnly: true } : {}),
    ...(upcomingOnlyRaw === 'true' ? { upcomingOnly: true } : {}),
  }).catch(() => null);

  if (!result) {
    return new NextResponse('Schedule data unavailable', { status: 502 });
  }

  const csv = buildScheduleCsv(result.items);
  const filename = `contract-schedule-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
