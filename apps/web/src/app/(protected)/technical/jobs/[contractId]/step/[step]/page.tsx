import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { loadTechnicalJob } from '../../../../_lib/technical-job-data';
import { isWorkflowStepKey, neighbours, STEP_PAGE_TEXT, technicalStepHref, VIEW_ONLY_MESSAGE } from '../../../../_lib/technical-step-ui';
import { WORKFLOW_STEPS } from '../../../../_lib/technical-workflow-helpers';
import type { WorkflowStepKey } from '../../../../_lib/technical-workflow-helpers';
import { TechnicalJobUnavailableView } from '../../../../_components/technical-job-unavailable';
import { WorkflowStepRow } from '../../../../_components/workflow-step-row';
import { CoverageSummaryCards, DrawingReadinessBanner } from '../../../../_components/coverage-summary-cards';
import { nextReleaseNote } from '../../../../_lib/drawing-file-ui';
import { BTN_NAV, BTN_NAV_PRIMARY } from '../../../../_lib/button-styles';
import { BoqItemFilesCard } from '../../../../_components/boq-item-files-card';
import { BoqDrawingConfirmation } from '../../_components/boq-drawing-confirmation';
import { DrawingGroupsSection } from '../../_components/drawing-groups-section';
import { FinalDrawingFilesSection } from '../../_components/final-files-and-release';
import { ReleaseToProductionSection } from '../../_components/release-to-production-section';

export const metadata: Metadata = { title: 'Technical Details — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ contractId: string; step: string }>;
}

// ---------------------------------------------------------------------------
// FMP-TECH-23 — one focused page per Technical step. It shows only that step's
// own section (the same components the single page used before, so every
// existing action keeps working behind its existing permission checks), a
// small stepper, and Back / Previous / Next. A step that is not ready shows
// what must be finished first instead of its controls.
// ---------------------------------------------------------------------------

const unavailable = (text: string): React.JSX.Element => <p className="text-sm text-text-muted">{text}</p>;

export default async function TechnicalStepPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { contractId, step } = await params;
  if (!isWorkflowStepKey(step)) notFound();
  const key: WorkflowStepKey = step;

  const data = await loadTechnicalJob(contractId, { withPieceStatuses: key === 'confirm-elements' });
  if (!data.ok) return <TechnicalJobUnavailableView info={data.unavailable} />;
  const { contract, canWrite, guided, boqConfirmations, boqAttachments, drawingGroups, coverage } = data;
  const model = guided.steps.find((s) => s.key === key)!;
  const index = WORKFLOW_STEPS.findIndex((s) => s.key === key);
  const { previous, next } = neighbours(key);
  const previousStep = previous ? guided.steps.find((s) => s.key === previous)! : null;
  const nextStep = next ? guided.steps.find((s) => s.key === next)! : null;
  const locked = model.state === 'locked';

  let content: React.JSX.Element;
  switch (key) {
    case 'boq-drawings':
      content =
        boqConfirmations && boqConfirmations.length > 0 ? (
          <section className="rounded-lg border border-border bg-surface p-5 shadow-sm" aria-label="BOQ Drawing Files">
            <BoqItemFilesCard
              contractId={contractId}
              items={boqConfirmations.map((i) => ({ id: i.boqItemId, sortOrder: i.sortOrder, itemCode: null, description: i.description, contractQty: i.contractQty, contractUnit: i.contractUnit }))}
              attachments={boqAttachments}
              currentUserId={data.currentUserId}
              canUpload={canWrite}
              canManage={data.canManageFiles}
              referenceText={STEP_PAGE_TEXT['boq-drawings']}
            />
          </section>
        ) : (
          unavailable(boqConfirmations ? 'This contract has no BOQ items yet.' : 'BOQ items could not be loaded. Please refresh the page.')
        );
      break;
    case 'confirm-elements':
      content = boqConfirmations
        ? <BoqDrawingConfirmation contractId={contractId} items={boqConfirmations} canWrite={canWrite} allowedPieceStatuses={data.allowedPieceStatuses} groupItems={drawingGroups} />
        : unavailable('BOQ items could not be loaded. Please refresh the page.');
      break;
    case 'drawing-groups':
      content = drawingGroups
        ? (
          <div className="space-y-4">
            {coverage && <CoverageSummaryCards summary={coverage.summary} />}
            {coverage && <DrawingReadinessBanner summary={coverage.summary} />}
            <p className="rounded-md bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
              Every element needs a final drawing before release to Production. The drawing can be uploaded for a group or for an individual element.
            </p>
            <DrawingGroupsSection contractId={contractId} items={drawingGroups} canWrite={canWrite} coverage={coverage} />
          </div>
        )
        : unavailable('Drawing groups could not be loaded. Please refresh the page.');
      break;
    case 'final-drawing-files':
      content = (
        <div className="space-y-4">
          {coverage && <CoverageSummaryCards summary={coverage.summary} />}
          <FinalDrawingFilesSection contractId={contractId} items={drawingGroups} coverage={coverage} canWrite={canWrite} />
        </div>
      );
      break;
    case 'release-to-production':
      content = <ReleaseToProductionSection contractId={contractId} items={drawingGroups} coverage={coverage} canWrite={canWrite} />;
      break;
  }

  const navBtn = BTN_NAV;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 px-5 py-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-xs text-text-muted">
        <Link href="/technical" className="hover:text-text-secondary hover:underline">Technical Dashboard</Link>
        {' > '}
        <Link href={`/technical/jobs/${contractId}`} className="hover:text-text-secondary hover:underline">Technical Details</Link>
        {' > '}
        <span className="text-text-secondary">{model.label}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Step {index + 1} of {WORKFLOW_STEPS.length} · Job Order {contract.jobOrder ?? contract.referenceNumber}</p>
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{model.label}</h1>
          <p className="text-sm text-text-secondary">{STEP_PAGE_TEXT[key]}</p>
        </div>
        <Link href={`/technical/jobs/${contractId}`} className={navBtn}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Technical Details
        </Link>
      </div>

      <WorkflowStepRow contractId={contractId} steps={guided.steps} active={key} />

      {!canWrite && <p className="rounded-md bg-surface-secondary px-3 py-2 text-xs text-text-secondary">{VIEW_ONLY_MESSAGE}</p>}

      {locked ? (
        <div className="rounded-lg border border-border bg-surface-secondary/40 p-6 text-center">
          <p className="text-sm font-semibold text-text-primary">Not ready</p>
          <p className="mt-1 text-sm text-text-secondary">{model.lockedMessage}</p>
          <Link href={`/technical/jobs/${contractId}`} className={`${navBtn} mt-4`}>Back to Technical Details</Link>
        </div>
      ) : (
        content
      )}

      {/* Previous / Next — Next only opens once that step is ready */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {previousStep ? (
          <Link href={technicalStepHref(contractId, previousStep.key)} className={navBtn}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Previous: {previousStep.label}
          </Link>
        ) : (
          <span />
        )}
        {nextStep &&
          (nextStep.state === 'locked' ? (
            <span className="flex flex-col items-end gap-1">
              <span aria-disabled="true" role="link" className={`${BTN_NAV} !bg-surface-secondary !text-text-muted !shadow-none`}>
                Next: {nextStep.label} (Not ready)
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
              <span className="text-xs text-text-muted">{key === 'final-drawing-files' ? nextReleaseNote(null, false) : nextStep.lockedMessage}</span>
            </span>
          ) : (
            <span className="flex flex-col items-end gap-1">
              <Link href={technicalStepHref(contractId, nextStep.key)} className={BTN_NAV_PRIMARY}>
                Next: {nextStep.label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {key === 'final-drawing-files' && <span className="text-xs text-text-muted">{nextReleaseNote(coverage?.summary ?? null, true)}</span>}
            </span>
          ))}
      </div>
    </div>
  );
}
