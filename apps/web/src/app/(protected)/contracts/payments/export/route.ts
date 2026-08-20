import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';
import { buildPaymentsCsv } from '../../_lib/contract-payment-csv';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const overdueOnlyRaw = searchParams.get('overdueOnly');

  const result = await contractsApi.listPayments({
    page: 1,
    pageSize: 500,
    ...(searchParams.get('search') ? { search: searchParams.get('search') as string } : {}),
    ...(searchParams.get('company') ? { company: searchParams.get('company') as string } : {}),
    ...(searchParams.get('contractId') ? { contractId: searchParams.get('contractId') as string } : {}),
    ...(searchParams.get('status') ? { status: searchParams.get('status') as string } : {}),
    ...(searchParams.get('departmentId') ? { departmentId: searchParams.get('departmentId') as string } : {}),
    ...(searchParams.get('ownerUserId') ? { ownerUserId: searchParams.get('ownerUserId') as string } : {}),
    ...(searchParams.get('invoiceDateFrom') ? { invoiceDateFrom: searchParams.get('invoiceDateFrom') as string } : {}),
    ...(searchParams.get('invoiceDateTo') ? { invoiceDateTo: searchParams.get('invoiceDateTo') as string } : {}),
    ...(searchParams.get('dueDateFrom') ? { dueDateFrom: searchParams.get('dueDateFrom') as string } : {}),
    ...(searchParams.get('dueDateTo') ? { dueDateTo: searchParams.get('dueDateTo') as string } : {}),
    ...(overdueOnlyRaw === 'true' ? { overdueOnly: true } : {}),
  }).catch(() => null);

  if (!result) {
    return new NextResponse('Payments data unavailable', { status: 502 });
  }

  const csv = buildPaymentsCsv(result.items);
  const filename = `contract-payments-register-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
