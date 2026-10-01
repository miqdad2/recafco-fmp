import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { technicalApi, TECHNICAL_STAGE_LABELS } from '@/lib/technical-api';
import { contractsApi } from '@/lib/contracts-api';
import { DrawingReceivedForm } from './_components/drawing-received-form';
import { TechnicalActivityTimeline } from './_components/technical-activity-timeline';
import { TechnicalChecklist } from './_components/technical-checklist';
import { TechnicalStepper } from '../../../../_components/technical-stepper';
import { computeStageMode } from '../../../../_lib/technical-format';

export const metadata: Metadata = { title: 'Drawing Received — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ contractId: string }>;
}

// ---------------------------------------------------------------------------
// FMP-TECH-01 — the first real Technical workflow screen. Every value shown
// (Job Order No, contract/client/manager, stage, drawing fields, activity,
// attachments) comes from TechnicalService.getDrawingReceived — real
// Contract/TechnicalWorkflow/TechnicalDrawing rows, never invented sample
// data (CT-2026-0012 / QTN-4471 / etc. never appear here).
//
// FMP-TECH-05O — reverts FMP-TECH-05N's internal-scroll workspace (header
// region fixed, body region `lg:overflow-y-auto`, right panel its own
// `lg:overflow-y-auto`, form footer pinned via a separate flex region):
// that produced 3 nested scrollbars on one page, which read as broken. Back
// to one single page, normal page-level scroll, `lg:sticky` panel — the
// exact shape this page had from FMP-TECH-05E through FMP-TECH-05M.
// ---------------------------------------------------------------------------

export default async function DrawingReceivedPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { contractId } = await params;
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];
  if (!permissions.includes('contracts.read')) notFound();
  const canWrite = permissions.includes('contracts.update') || permissions.includes('contracts.workflow_update');
  const canManageAttachments = permissions.includes('contracts.manage');
  const currentUserId = meResult.ok ? meResult.data.id : '';

  let data: Awaited<ReturnType<typeof technicalApi.drawingReceived>>;
  try {
    data = await technicalApi.drawingReceived(contractId);
  } catch {
    // No workflow started yet, contract not found, or out of scope — the
    // overview page already renders the correct explanation/action for
    // every one of those cases.
    redirect(`/technical/jobs/${contractId}`);
  }

  const { contract, workflow, drawing, attachments, activities, nextStage } = data;

  let people: { id: string; displayName: string }[] = [];
  try {
    people = await contractsApi.people();
  } catch {
    people = [];
  }

  const mode = computeStageMode('DRAWING_RECEIVED', workflow.currentStage, workflow.status);

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
        <span className="text-text-secondary">Drawing Received</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            Technical Team
          </span>
          <span className="rounded-full bg-warning-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
            {workflow.status === 'COMPLETED' ? 'Completed' : drawing?.status === 'DRAFT' || !drawing ? 'Draft' : 'In Progress'}
          </span>
        </div>
        <h1 className="mt-1.5 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Drawing Received</h1>
        <p className="text-sm text-text-secondary">Record received client/consultant drawings and prepare the next technical workflow step.</p>
      </div>

      {/* Summary card — FMP-TECH-05B: only the 7 fields a manager actually
          needs; the raw Contract UUID ("System Ref") is deliberately never
          shown on this page (the ticket's own preferred option over a
          muted/collapsible treatment). */}
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

      {/* Workflow stepper — FMP-TECH-05E: the shared, clickable
          TechnicalStepper (used by all 4 stage pages + the workflow
          overview) so users can open any stage — including ones not yet
          reached — in locked preview mode straight from here. */}
      <TechnicalStepper contractId={contractId} currentStage={workflow.currentStage} workflowStatus={workflow.status} />

      {/* Guidance strip — compact info strip, 3 bullets only */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border border-l-2 border-l-accent bg-surface-secondary/50 px-3.5 py-1.5 text-xs text-text-secondary">
        <Info className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
        <span>Upload received drawing files.</span>
        <span aria-hidden="true">·</span>
        <span>Enter drawing reference, revision, and received date.</span>
        <span aria-hidden="true">·</span>
        <span>Complete this step to move to SD &amp; Calculation Submission.</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18fr_7fr] lg:items-start">
        <DrawingReceivedForm
          contractId={contractId}
          drawing={drawing}
          attachments={attachments}
          people={people}
          canWrite={canWrite}
          mode={mode}
          currentStage={workflow.currentStage}
          currentUserId={currentUserId}
          canManageAttachments={canManageAttachments}
        />

        {/* FMP-TECH-05D — "Task Status": a leaner replacement for
            FMP-TECH-05C's "Workflow Panel" (same 3 sub-sections, trimmed
            further). On tablet/mobile (grid collapses to 1 column), this
            renders after the form.
            FMP-TECH-05E: sticky on desktop only (`lg:sticky`, disabled
            below `lg`) with a small top offset — `<main>` (the app shell's
            own scroll container, not the window) has no fixed header
            inside it, so this sticks safely without covering anything. */}
        <div className="rounded-lg border border-border bg-surface lg:sticky lg:top-4">
          <div className="px-4 py-2.5">
            <h2 className="text-sm font-semibold text-text-primary">Task Status</h2>
          </div>
          <div className="divide-y divide-border border-t border-border">
            <div className="p-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Completion Checklist</h3>
              <div className="mt-2">
                <TechnicalChecklist drawing={drawing} attachments={attachments} />
              </div>
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
              {/* Latest 2 activities only (was 3 in FMP-TECH-05C) — a
                  display-only slice of the same real activity list every
                  other stage page still shows in full. No "View all
                  activity" link — no such page exists. */}
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
