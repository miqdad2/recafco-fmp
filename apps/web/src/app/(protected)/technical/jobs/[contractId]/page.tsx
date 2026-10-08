import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Ruler, ArrowRight, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { technicalApi, fetchBoqConfirmations, fetchAllowedPieceStatuses, fetchDrawingGroups, TECHNICAL_STAGE_LABELS, TECHNICAL_STAGE_ORDER } from '@/lib/technical-api';
import { startTechnicalWorkflowFormAction } from '../../actions';
import { formatDate, priorityLabel, computeStageMode, stageHref, STAGE_OPEN_LABELS } from '../../_lib/technical-format';
import type { TechnicalStageMode } from '../../_lib/technical-format';
import { TechnicalStepper } from '../../_components/technical-stepper';
import { BoqDrawingConfirmation } from './_components/boq-drawing-confirmation';
import { DrawingGroupsSection } from './_components/drawing-groups-section';

function stageStatusBadge(mode: TechnicalStageMode): { label: string; className: string } {
  if (mode === 'active') return { label: 'Current', className: 'bg-accent-light text-accent' };
  if (mode === 'completed') return { label: 'Completed', className: 'bg-success-light text-success' };
  return { label: 'Pending', className: 'bg-surface-secondary text-text-muted' };
}

export const metadata: Metadata = { title: 'Technical Workflow — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ contractId: string }>;
}

// ---------------------------------------------------------------------------
// FMP-TECH-01 — a real Contract/job order's own Technical workflow overview:
// current/next stage if a workflow already exists, or a real "Technical
// workflow not started" state with a "Start Technical Workflow" action if
// not — never a fabricated stage.
//
// FMP-TECH-05G — this is the workflow's navigation hub: every one of the 4
// stage pages can be opened from here at any time (internal RECAFCO system,
// not a gated external one). Opening a page is always allowed; submitting
// or completing a stage remains controlled entirely by each stage page's
// own `mode` check and, ultimately, the backend's own
// `assertXxxStageIsCurrent()` gates — nothing about navigation visibility
// changes what a write action accepts.
// ---------------------------------------------------------------------------

export default async function TechnicalJobPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { contractId } = await params;
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();

  let overview: Awaited<ReturnType<typeof technicalApi.workflowOverview>> | null = null;
  try {
    overview = await technicalApi.workflowOverview(contractId);
  } catch {
    notFound();
  }

  const { contract, workflow, nextStage } = overview;
  // FMP-BOQ-03 — null when it could not be loaded; the section is then simply left out.
  const [boqConfirmations, allowedPieceStatuses, drawingGroups] = await Promise.all([
    fetchBoqConfirmations(contractId),
    fetchAllowedPieceStatuses(contractId),
    fetchDrawingGroups(contractId),
  ]);
  const canWrite = permissions.includes('contracts.update') || permissions.includes('contracts.workflow_update');
  // FMP-TECH-04 — `nextStage` is already null as soon as currentStage
  // reaches FD_ISSUANCE (nextStageOf(FD_ISSUANCE) has no later stage),
  // regardless of whether FD Issuance has actually been completed yet — so
  // "the workflow is done" must be read from workflow.status, not from
  // nextStage being null.
  const workflowCompleted = workflow?.status === 'COMPLETED';

  return (
    <div className="mx-auto max-w-[1320px] space-y-4 px-5 py-6 lg:px-6">
      <nav aria-label="Breadcrumb" className="text-xs text-text-muted">
        <Link href="/contracts" className="hover:text-text-secondary hover:underline">Contract Management</Link>
        {' > '}
        <Link href="/technical" className="hover:text-text-secondary hover:underline">Technical Dashboard</Link>
        {' > '}
        <span>Job Order {contract.jobOrder ?? contract.referenceNumber}</span>
        {' > '}
        <span className="text-text-secondary">Technical Workflow</span>
      </nav>

      {/* FMP-TECH-05G — clear top navigation, right beside the header, so
          it's visible without scrolling to the bottom of the page. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
            <Ruler className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Technical Workflow</h1>
            <p className="text-sm text-text-secondary">Job Order {contract.jobOrder ?? '—'} — {contract.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/technical" className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-secondary">
            Back to Technical Dashboard
          </Link>
          <Link href={`/contracts/${contractId}`} className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-secondary">
            Back to Contract
          </Link>
          <Link href="/dashboard" className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-secondary">
            Back to Platform Dashboard
          </Link>
        </div>
      </div>

      {/* Job/order summary — FMP-TECH-05G: added the missing "Project /
          Contract Name" field and widened to a 3-column grid so it uses
          the page's own wider width instead of staying a narrow strip.
          System Ref shows the real human reference (never the raw
          Contract UUID) and stays visually secondary/muted. */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Job Order No</dt>
            <dd className="mt-0.5 text-sm font-semibold text-text-primary">{contract.jobOrder ?? '—'}</dd>
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
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Department</dt>
            <dd className="mt-0.5 text-sm text-text-secondary">Technical</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Priority</dt>
            <dd className="mt-0.5 text-sm text-text-secondary">{priorityLabel(workflow?.priority)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">System Ref</dt>
            <dd className="mt-0.5 text-sm text-text-muted">{contract.referenceNumber}</dd>
          </div>
        </dl>
      </div>

      {workflow ? (
        <div className="space-y-4">
          {/* Current stage summary — kept compact per the ticket's own
              "avoid making this section too large" instruction. */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current Technical Stage</p>
                <p className="mt-0.5 text-lg font-bold text-text-primary">{TECHNICAL_STAGE_LABELS[workflow.currentStage]}</p>
              </div>
              {nextStage && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <ArrowRight className="size-4" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Next Technical Stage</p>
                    <p className="mt-0.5 text-sm font-medium">{TECHNICAL_STAGE_LABELS[nextStage]}</p>
                  </div>
                </div>
              )}
              {workflowCompleted && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Technical Workflow Completed
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-text-muted">Started {formatDate(workflow.startedAt)} · Last updated {formatDate(workflow.updatedAt)}</p>
          </div>

          {/* Compact clickable stepper — shared across all 4 stage pages
              and this overview (FMP-TECH-05E). */}
          <TechnicalStepper contractId={contractId} currentStage={workflow.currentStage} workflowStatus={workflow.status} />

          {/* FMP-TECH-05G — the workflow navigation hub itself: one card
              per stage (number, name, status, Open button), replacing the
              old flat button row. Every stage is openable anytime — this
              is an internal RECAFCO system, not a gated external one; only
              submitting/completing a stage is controlled by each stage's
              own page + the backend's write validation. */}
          <div>
            <p className="text-xs text-text-muted">Open any stage to view its details. Workflow completion is controlled by each stage action.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TECHNICAL_STAGE_ORDER.map((stage, i) => {
                const mode = computeStageMode(stage, workflow.currentStage, workflow.status);
                const status = stageStatusBadge(mode);
                return (
                  <div key={stage} className="flex flex-col rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-text-secondary">
                        {i + 1}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-text-primary">{TECHNICAL_STAGE_LABELS[stage]}</p>
                    <Link
                      href={stageHref(contractId, stage)}
                      className="mt-3 inline-flex items-center justify-center rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface"
                    >
                      {STAGE_OPEN_LABELS[stage]}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {workflowCompleted && (
            <div className="rounded-lg border border-success bg-success-light p-4 text-sm text-success">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Technical Workflow Completed — Ready for downstream execution.
              </p>
              <p className="mt-1 text-success/90">
                All 4 Technical stages are complete for this job order. Production/Erection/Delivery integration is not built in this unit.
              </p>
              <Link href={`/technical/jobs/${contractId}/workflow/fd-issuance`} className="mt-2 inline-block text-sm font-medium underline">
                View FD Issuance details
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-base font-medium text-text-primary">Technical workflow not started</p>
          <p className="mt-1 text-sm text-text-secondary">No Technical workflow exists yet for this job order.</p>
          {canWrite ? (
            <form action={startTechnicalWorkflowFormAction.bind(null, contractId)} className="mt-4">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                Start Technical Workflow
              </button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-text-muted">Contact a Contract Manager to start this job order&apos;s Technical workflow.</p>
          )}
        </div>
      )}

      {/* FMP-BOQ-03 — Technical records the drawing-confirmed physical pieces per BOQ item. */}
      {boqConfirmations && (
        <BoqDrawingConfirmation
          contractId={contractId}
          items={boqConfirmations}
          canWrite={canWrite}
          allowedPieceStatuses={allowedPieceStatuses}
        />
      )}

      {/* FMP-BOQ-11 — group generated pieces by the drawing / calculation that covers them. */}
      {drawingGroups && <DrawingGroupsSection contractId={contractId} items={drawingGroups} canWrite={canWrite} />}
    </div>
  );
}
