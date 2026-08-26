import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { computeCloseoutWarnings } from '../../../_lib/contract-ui-helpers';
import { CloseoutReadinessCards } from './_components/closeout-readiness-cards';
import { CloseoutWarningsPanel } from './_components/closeout-warnings-panel';
import { CloseoutRequestForm } from './_components/closeout-request-form';
import { CloseoutReviewerPanel } from './_components/closeout-reviewer-panel';
import { CloseoutAttachmentsPanel } from './_components/closeout-attachments-panel';

export const metadata: Metadata = { title: 'Contract Closeout — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const ACTIVE_REQUEST_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED']);

export default async function ContractCloseoutTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, contract, checks, requests] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi.getCloseoutChecks(id).catch(() => null),
    contractsApi.listCloseoutRequests(id).catch(() => null),
  ]);
  if (!contract || !requests) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const canReview = permissions.includes('contracts.close');

  const latestRequest = requests[0] ?? null;
  const hasActiveRequest = latestRequest ? ACTIVE_REQUEST_STATUSES.has(latestRequest.status) : false;
  const showRequestForm = contract.status !== 'CLOSED' && !hasActiveRequest && (!latestRequest || latestRequest.status !== 'CLOSED');

  const [attachments] = await Promise.all([
    latestRequest ? contractsApi.listCloseoutAttachments(latestRequest.id).catch(() => []) : Promise.resolve([]),
  ]);

  const warnings = checks ? computeCloseoutWarnings(checks) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Contract Closeout</h1>
        <p className="text-xs text-text-secondary mt-0.5">Final verification and approval before closing and archiving the contract.</p>
      </div>

      {/* Closeout Readiness */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Closeout Readiness</h2>
        <CloseoutReadinessCards checks={checks} />
      </section>

      {/* Warnings */}
      <CloseoutWarningsPanel warnings={warnings} />

      {/* Closeout Request */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Closeout Request</h2>

        {contract.status === 'CLOSED' && latestRequest?.status === 'CLOSED' ? (
          <CloseoutReviewerPanel contractId={id} request={latestRequest} canReview={false} />
        ) : showRequestForm ? (
          canUpdate ? (
            <CloseoutRequestForm contractId={id} />
          ) : (
            <p className="text-sm text-text-muted">
              {latestRequest?.status === 'REJECTED'
                ? 'The previous closeout request was rejected. A user with contract update access can submit a new one.'
                : 'No closeout request has been submitted for this contract yet.'}
            </p>
          )
        ) : latestRequest ? (
          <CloseoutReviewerPanel contractId={id} request={latestRequest} canReview={canReview} />
        ) : (
          <p className="text-sm text-text-muted">No closeout request has been submitted for this contract yet.</p>
        )}
      </section>

      {/* Closeout Documents */}
      {latestRequest && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Closeout Documents</h2>
          <CloseoutAttachmentsPanel
            contractId={id}
            requestId={latestRequest.id}
            attachments={attachments}
            canUpload={canUpdate && hasActiveRequest}
          />
        </section>
      )}
    </div>
  );
}
