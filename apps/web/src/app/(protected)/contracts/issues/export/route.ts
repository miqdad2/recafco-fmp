import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import { buildIssuesCsv } from '../../_lib/contract-issue-csv';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const overdueOnlyRaw = searchParams.get('overdueOnly');

  const result = await contractsApi.listIssues({
    page: 1,
    pageSize: 500,
    ...(searchParams.get('search') ? { search: searchParams.get('search') as string } : {}),
    ...(searchParams.get('contractId') ? { contractId: searchParams.get('contractId') as string } : {}),
    ...(searchParams.get('status') ? { status: searchParams.get('status') as string } : {}),
    ...(searchParams.get('priority') ? { priority: searchParams.get('priority') as string } : {}),
    ...(searchParams.get('category') ? { category: searchParams.get('category') as string } : {}),
    ...(searchParams.get('departmentId') ? { departmentId: searchParams.get('departmentId') as string } : {}),
    ...(searchParams.get('responsibleUserId') ? { responsibleUserId: searchParams.get('responsibleUserId') as string } : {}),
    ...(searchParams.get('raisedDateFrom') ? { raisedDateFrom: searchParams.get('raisedDateFrom') as string } : {}),
    ...(searchParams.get('raisedDateTo') ? { raisedDateTo: searchParams.get('raisedDateTo') as string } : {}),
    ...(searchParams.get('dueDateFrom') ? { dueDateFrom: searchParams.get('dueDateFrom') as string } : {}),
    ...(searchParams.get('dueDateTo') ? { dueDateTo: searchParams.get('dueDateTo') as string } : {}),
    ...(overdueOnlyRaw === 'true' ? { overdueOnly: true } : {}),
  }).catch(() => null);

  if (!result) {
    return new NextResponse('Issue data unavailable', { status: 502 });
  }

  const csv = buildIssuesCsv(result.items);
  const filename = `contract-issues-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
