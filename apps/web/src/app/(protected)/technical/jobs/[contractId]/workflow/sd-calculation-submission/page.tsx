import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Circle, Info } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { technicalApi, TECHNICAL_STAGE_LABELS, TECHNICAL_STAGE_ORDER } from '@/lib/technical-api';
import { SdCalculationSubmissionForm } from './_components/sd-calculation-submission-form';
import { TechnicalActivityTimeline } from '../drawing-received/_components/technical-activity-timeline';
import { TechnicalStepper } from '../../../../_components/technical-stepper';
import { computeStageMode } from '../../../../_lib/technical-format';
import { canReadTechnical, canWriteTechnical, canManageTechnical } from '@/app/(protected)/technical/_lib/technical-permissions';

export const metadata: Metadata = { title: 'SD & Calculation Submission — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ contractId: string }>;
}

// ---------------------------------------------------------------------------
// FMP-TECH-02 — Technical Stage 2. Every value shown (Job Order No,
// contract/client/manager, stage, submission fields, related Drawing
// Received records, activity, attachments) comes from
// TechnicalService.getSdCalculationSubmission — real Contract/
// TechnicalWorkflow/TechnicalDrawing/TechnicalSdCalculationSubmission rows,
// never invented sample data. Reuses TechnicalActivityTimeline from the
// Drawing Received screen as-is (activities are scoped per-workflow, not
// per-stage, so the same component already renders correctly here without
// any change to that file).
//
// FMP-TECH-05O — reverts FMP-TECH-05N's internal-scroll workspace back to
// one single page with normal page-level scroll — see
// drawing-received/page.tsx's own doc comment for the full reasoning.
// ---------------------------------------------------------------------------

export default async function SdCalculationSubmissionPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { contractId } = await params;
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];
  if (!canReadTechnical(permissions)) notFound();
  const canWrite = canWriteTechnical(permissions);
  const canManageAttachments = canManageTechnical(permissions);
  const currentUserId = meResult.ok ? meResult.data.id : '';

  let data: Awaited<ReturnType<typeof technicalApi.sdCalculationSubmission>>;
  try {
    data = await technicalApi.sdCalculationSubmission(contractId);
  } catch {
    // No workflow started yet, contract not found, or out of scope — the
    // overview page already renders the correct explanation/action for
    // every one of those cases.
    redirect(`/technical/jobs/${contractId}`);
  }

  const { contract, workflow, submission, completedDrawings, attachments, activities, nextStage } = data;
  const mode = computeStageMode('SD_CALCULATION_SUBMISSION', workflow.currentStage, workflow.status);

  const currentStepIndex = TECHNICAL_STAGE_ORDER.indexOf(workflow.currentStage);

  return (
    <div className="mx-auto max-w-[1320px] space-y-3 px-5 py-6 lg:px-6">
      <nav aria-label="Breadcrumb" className="text-xs text-text-muted">
        <Link href="/contracts" className="hover:text-text-secondary hover:underline">Contract Management</Link>
        {' > '}
        <Link href={`/technical/jobs/${contractId}`} className="hover:text-text-secondary hover:underline">
          Job Order {contract.jobOrder ?? contract.referenceNumber}
        </Link>
        {' > '}
        <Link href={`/technical/jobs/${contractId}`} className="hover:text-text-secondary hover:underline">Technical Workflow</Link>
        {' > '}
        <span className="text-text-secondary">SD & Calculation Submission</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            Technical Team
          </span>
          <span className="rounded-full bg-warning-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
            {submission?.status === 'COMPLETED' ? 'Completed'
              : submission?.status === 'SUBMITTED' ? 'Submitted'
              : submission?.status === 'CLARIFICATION_REQUESTED' ? 'Clarification Requested'
              : submission?.status === 'IN_PROGRESS' ? 'In Progress'
              : 'Draft'}
          </span>
        </div>
        <h1 className="mt-1.5 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">SD & Calculation Submission</h1>
        <p className="text-sm text-text-secondary">Prepare and submit shop drawings and structural/design calculations for review and approval.</p>
      </div>

      {/* Summary card — FMP-TECH-05H: matches Drawing Received's own
          summary card exactly (same 7 fields, same compact style); the
          raw Contract UUID is never shown on this page either. */}
      <div className="rounded-lg border border-border bg-surface p-3.5">
        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Job Order No</dt>
            <dd className="mt-0.5 text-sm font-semibold text-text-primary">{contract.jobOrder ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Contract No / Quotation No</dt>
            <dd className="mt-0.5 text-sm text-text-secondary">{contract.referenceNumber}{contract.quotationNumber ? ` / ${contract.quotationNumber}` : ''}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Project / Contract Name</dt>
            <dd className="mt-0.5 text-sm text-text-secondary">{contract.title}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Client / Employer</dt>
            <dd className="mt-0.5 text-sm text-text-secondary">{contract.counterpartyName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Contract Manager</dt>
            <dd className="mt-0.5 text-sm text-text-secondary">{contract.ownerUser.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current Technical Stage</dt>
            <dd className="mt-0.5 text-sm font-medium text-text-primary">{TECHNICAL_STAGE_LABELS[workflow.currentStage]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Next Technical Stage</dt>
            <dd className="mt-0.5 text-sm text-text-secondary">{nextStage ? TECHNICAL_STAGE_LABELS[nextStage] : 'None — final stage'}</dd>
          </div>
        </dl>
      </div>

      {/* Workflow stepper — shared, clickable across all 4 stage pages. */}
      <TechnicalStepper contractId={contractId} currentStage={workflow.currentStage} workflowStatus={workflow.status} />

      {/* Guidance strip — compact info strip, matching Drawing Received's
          own treatment (3 bullets, single line, no large guidance card). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border border-l-2 border-l-accent bg-surface-secondary/50 px-3.5 py-1.5 text-xs text-text-secondary">
        <Info className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
        <span>Prepare and submit shop drawings and structural/design calculations.</span>
        <span aria-hidden="true">·</span>
        <span>Link this submission to the received drawing record.</span>
        <span aria-hidden="true">·</span>
        <span>Upload SD/calculation files before completing this stage.</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18fr_7fr] lg:items-start">
        <SdCalculationSubmissionForm
          contractId={contractId}
          submission={submission}
          completedDrawings={completedDrawings}
          attachments={attachments}
          canWrite={canWrite}
          mode={mode}
          currentStage={workflow.currentStage}
          currentUserId={currentUserId}
          canManageAttachments={canManageAttachments}
        />

        {/* FMP-TECH-05H — "Stage Status": one combined panel (was 3
            separate-looking boxes: Workflow Steps / Task Details /
            Activity), matching Drawing Received's own "Task Status"
            pattern. Sticky on desktop for the same reason Drawing
            Received's panel is. */}
        <div className="rounded-lg border border-border bg-surface lg:sticky lg:top-4">
          <div className="px-4 py-2.5">
            <h2 className="text-sm font-semibold text-text-primary">Stage Status</h2>
          </div>
          <div className="divide-y divide-border border-t border-border">
            <div className="p-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Workflow Steps</h3>
              <ul className="mt-2 space-y-2">
                {TECHNICAL_STAGE_ORDER.map((stage, i) => {
                  const done = i < currentStepIndex;
                  return (
                    <li key={stage} className="flex items-center gap-2 text-sm">
                      {done ? (
                        <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                      ) : (
                        <Circle className={`size-4 shrink-0 ${i === currentStepIndex ? 'text-accent' : 'text-text-muted'}`} aria-hidden="true" />
                      )}
                      <span className={i === currentStepIndex ? 'font-semibold text-text-primary' : done ? 'text-text-secondary' : 'text-text-muted'}>
                        {TECHNICAL_STAGE_LABELS[stage]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="p-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current Status</h3>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-text-muted">Department</dt>
                  <dd className="text-text-secondary">Technical</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-muted">Current Stage</dt>
                  <dd className="text-text-secondary">{TECHNICAL_STAGE_LABELS[workflow.currentStage]}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-muted">Status</dt>
                  <dd className="text-text-secondary">{workflow.status === 'COMPLETED' ? 'Completed' : 'In Progress'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-muted">Last Updated</dt>
                  <dd className="text-text-secondary">{new Date(workflow.updatedAt).toLocaleDateString('en-GB')}</dd>
                </div>
              </dl>
            </div>

            <div className="p-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Latest Activity</h3>
              <div className="mt-2">
                <TechnicalActivityTimeline activities={activities.slice(0, 2)} bare />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
