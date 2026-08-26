import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import { buildCloseoutsCsv } from '../../_lib/contract-closeout-csv';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const pendingOnlyRaw = searchParams.get('pendingOnly');

  const result = await contractsApi.listCloseouts({
    page: 1,
    pageSize: 500,
    ...(searchParams.get('search') ? { search: searchParams.get('search') as string } : {}),
    ...(searchParams.get('contractId') ? { contractId: searchParams.get('contractId') as string } : {}),
    ...(searchParams.get('status') ? { status: searchParams.get('status') as string } : {}),
    ...(searchParams.get('requestedByUserId') ? { requestedByUserId: searchParams.get('requestedByUserId') as string } : {}),
    ...(searchParams.get('reviewedByUserId') ? { reviewedByUserId: searchParams.get('reviewedByUserId') as string } : {}),
    ...(searchParams.get('departmentId') ? { departmentId: searchParams.get('departmentId') as string } : {}),
    ...(searchParams.get('requestedDateFrom') ? { requestedDateFrom: searchParams.get('requestedDateFrom') as string } : {}),
    ...(searchParams.get('requestedDateTo') ? { requestedDateTo: searchParams.get('requestedDateTo') as string } : {}),
    ...(searchParams.get('reviewedDateFrom') ? { reviewedDateFrom: searchParams.get('reviewedDateFrom') as string } : {}),
    ...(searchParams.get('reviewedDateTo') ? { reviewedDateTo: searchParams.get('reviewedDateTo') as string } : {}),
    ...(searchParams.get('approvedDateFrom') ? { approvedDateFrom: searchParams.get('approvedDateFrom') as string } : {}),
    ...(searchParams.get('approvedDateTo') ? { approvedDateTo: searchParams.get('approvedDateTo') as string } : {}),
    ...(pendingOnlyRaw === 'true' ? { pendingOnly: true } : {}),
  }).catch(() => null);

  if (!result) {
    return new NextResponse('Closeout data unavailable', { status: 502 });
  }

  const csv = buildCloseoutsCsv(result.items);
  const filename = `contract-closeouts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
