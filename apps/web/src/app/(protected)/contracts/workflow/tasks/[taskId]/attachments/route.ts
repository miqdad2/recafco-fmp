import { NextResponse } from 'next/server';
import { contractsApi } from '@/lib/contracts-api';
import { getUserPermissions } from '@/app/(protected)/contracts/_lib/get-user-permissions';

export const dynamic = 'force-dynamic';

/** Client-fetchable JSON proxy — the task drawer (a 'use client' component) can't call contractsApi directly since it depends on next/headers. */
export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }): Promise<Response> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { taskId } = await params;
  try {
    const attachments = await contractsApi.listWorkflowTaskAttachments(taskId);
    return NextResponse.json({ data: attachments });
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : 'Failed to load attachments', { status: 502 });
  }
}
