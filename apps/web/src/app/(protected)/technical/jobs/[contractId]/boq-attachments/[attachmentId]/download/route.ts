import { proxyBoqAttachment } from '../../../../../_lib/boq-attachment-server';

export const dynamic = 'force-dynamic';

// FMP-BOQ-17 — download a BOQ item file (permission and department access are re-checked by the API).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string; attachmentId: string }> },
): Promise<Response> {
  const { contractId, attachmentId } = await params;
  return proxyBoqAttachment(contractId, attachmentId, 'download');
}
