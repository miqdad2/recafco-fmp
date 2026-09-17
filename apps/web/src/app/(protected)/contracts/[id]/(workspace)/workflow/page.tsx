import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, HardHat, Eye } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getCurrentUserContext } from '../../../_lib/get-user-permissions';
import { WorkflowBoard } from '../../../workflow/_components/workflow-board';
import { WorkflowStatusBadge } from '../../../workflow/_components/workflow-status-badge';
import { WorkflowPollingRefresher } from '../../../workflow/_components/workflow-polling-refresher';
import { ErectionWorkflowAssignmentCard } from './_components/erection-workflow-assignment-card';

export const metadata: Metadata = { title: 'Workflow & Team Tasks — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/** CM-71H.10 — the 6 guided erection screens, in step order, for the manager-tier-only "Erection Workflow Screens Preview" section. `path` is appended to `/contracts/{id}/workflow/erection/`. */
const ERECTION_STEP_PREVIEW_SCREENS = [
  { step: 1, label: 'Step 1: Issue Erection Method Statement', path: 'method-statement' },
  { step: 2, label: 'Step 2: Erection Method Statement Approval', path: 'method-statement/approval' },
  { step: 3, label: 'Step 3: Issue Erection Schedule', path: 'schedule' },
  { step: 4, label: 'Step 4: Delivery Start', path: 'delivery-start' },
  { step: 5, label: 'Step 5: Erection Start', path: 'start' },
  { step: 6, label: 'Step 6: Erection Checklist', path: 'checklist' },
] as const;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContractWorkflowTab({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;
  const myTasksOnly = search['myTasksOnly'] === 'true';

  const [{ id: currentUserId, permissions }, workflow, people, erectionStatement, erectionApproval, erectionSchedule, erectionDeliveryStart, erectionStart, erectionChecklist, erectionAssignment] = await Promise.all([
    getCurrentUserContext(),
    contractsApi.getWorkflow(id, { myTasksOnly }).catch(() => null),
    contractsApi.people().catch(() => []),
    contractsApi.getErectionMethodStatement(id).catch(() => null),
    contractsApi.getErectionMethodStatementApproval(id).catch(() => null),
    contractsApi.getErectionSchedule(id).catch(() => null),
    contractsApi.getErectionDeliveryStart(id).catch(() => null),
    contractsApi.getErectionStart(id).catch(() => null),
    contractsApi.getErectionChecklist(id).catch(() => null),
    contractsApi.getErectionWorkflowAssignment(id).catch(() => null),
  ]);
  if (!workflow) notFound();

  // CM-71C — Step 2 becomes the relevant next action once Step 1 has left
  // Draft, matching this unit's own "show Step 2 as the next action when
  // Step 1 is Submitted for Approval or Issued" instruction (same rule
  // used by the Erection Dashboard's own work queue action).
  const erectionStep2Ready = erectionStatement !== null
    && (erectionStatement.status === 'SUBMITTED_FOR_APPROVAL' || erectionStatement.status === 'ISSUED');
  // CM-71D — Step 3 becomes the relevant next action once Step 2 has been
  // Approved, matching this unit's own "Workflow & Team Tasks tab shows
  // Step 3 action when Step 2 is Approved" instruction.
  const erectionStep3Ready = erectionApproval?.reviewStatus === 'APPROVED';
  // CM-71E — Step 4 becomes the relevant next action once Step 3 has been
  // Issued, matching this unit's own "Show Step 4 button/action when Step 3
  // status is Issued" instruction.
  const erectionStep4Ready = erectionSchedule?.status === 'ISSUED';
  // CM-71F — Step 5 becomes the relevant next action once Step 4 has been
  // Started, matching this unit's own "Show Step 5 button/action when Step
  // 4 status is Started" instruction.
  const erectionStep5Ready = erectionDeliveryStart?.status === 'STARTED';
  // CM-71G — Step 6 becomes the relevant next action once Step 5 has been
  // Started, matching this unit's own "Show Step 6 button/action when Step
  // 5 status is Started" instruction.
  const erectionStep6Ready = erectionStart?.status === 'STARTED';

  const canManage = permissions.includes('contracts.update');
  const canUpdateAssigned = permissions.includes('contracts.workflow_update');
  const { tasks, progress, contract } = workflow;
  const generatedAt = new Date().toLocaleTimeString('en-GB');

  // CM-71H — "Erection Workflow card" own Current Step / Last Updated,
  // mirroring the Erection Dashboard's computeCurrentErectionStepLabel rule
  // (Steps 1-6 in order, honestly falling back to "Step 6" until Step 7 has
  // its own screen) using the SAME per-step records already fetched above
  // for the step-button ready-flags — no duplicate backend call.
  const erectionCurrentStepLabel = !erectionStatement || erectionStatement.status === 'DRAFT'
    ? 'Step 1: Issue Erection Method Statement'
    : erectionApproval?.reviewStatus !== 'APPROVED'
      ? 'Step 2: Erection Method Statement Approval'
      : erectionSchedule?.status !== 'ISSUED'
        ? 'Step 3: Issue Erection Schedule'
        : erectionDeliveryStart?.status !== 'STARTED'
          ? 'Step 4: Delivery Start'
          : erectionStart?.status !== 'STARTED'
            ? 'Step 5: Erection Start'
            : erectionChecklist?.status !== 'SUBMITTED_FOR_VERIFICATION' && erectionChecklist?.status !== 'VERIFIED'
              ? 'Step 6: Erection Checklist'
              : 'Step 7: Payment Issued (not built yet)';
  const erectionLastUpdated = [erectionStatement, erectionApproval, erectionSchedule, erectionDeliveryStart, erectionStart, erectionChecklist]
    .map((x) => (x as { updatedAt?: string } | null)?.updatedAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1) ?? null;

  // CM-71H.1 — "Contract Manager sees erection updates as monitoring, not
  // execution owner; assigned Erection Manager gets Continue/Update" applied
  // to THIS page too, not just the Erection Dashboard (CM-71H's own
  // viewerActionMode). The individual Step 1/3/5 buttons below are left
  // exactly as-is (still real links, still gated by each step's own real
  // permission check) — this is a viewer-relation LABEL, not a new access
  // gate, so it cannot make an already-working button stop working.
  const isAssignedErectionManager = erectionAssignment?.assignedToUserId === currentUserId;
  const erectionViewerRelationLabel = isAssignedErectionManager
    ? 'You are the assigned Erection Manager — Continue / Update'
    : canManage
      ? 'Monitoring as Contract Manager — View Status'
      : erectionAssignment
        ? 'Assigned to another user'
        : 'Not yet assigned';

  return (
    <div className="space-y-4">
      <WorkflowPollingRefresher />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Workflow &amp; Team Tasks</h1>
          <p className="text-xs text-text-secondary mt-0.5">Track contract workflow progress, team responsibilities and pending tasks.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-muted">Last updated {generatedAt}</span>
          <Link
            href={`/contracts/workflow?contractId=${id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Open in Workflow Register
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* CM-71A — Erection Workflow entry point. A dedicated, more structured
          7-step workflow distinct from the generic Team Task Register above
          (only Step 1, Issue Erection Method Statement, has a real screen
          today — see progress-tracker.md for CM-71B onward). */}
      <section className="rounded-lg border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <HardHat className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Erection Workflow
              <span className="ml-2 align-middle inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">Guided Workflow</span>
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              7-step structured erection process, starting with the Method Statement — a separate, guided path
              from the individual task cards in the Workflow Progress Board below.
            </p>
            {/* CM-71H — Owner / Assigned To / Current Step / Last Updated, consolidated into this existing card rather than a second, largely-redundant "Erection Workflow card" — see progress-tracker.md for why. */}
            <dl className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px]">
              <div className="flex items-center gap-1">
                <dt className="text-text-muted">Owner:</dt>
                <dd className="font-medium text-text-primary">Erection Department</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-text-muted">Assigned To:</dt>
                <dd className="font-medium text-text-primary">
                  {erectionAssignment?.assignedToUser?.displayName ?? erectionAssignment?.assignedToName ?? 'Not assigned yet'}
                </dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-text-muted">Current Step:</dt>
                <dd className="font-medium text-text-primary">{erectionCurrentStepLabel}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-text-muted">Assignment Status:</dt>
                <dd className="font-medium text-text-primary">{erectionAssignment?.status ?? 'Not Assigned'}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="text-text-muted">Last Updated:</dt>
                <dd className="font-medium text-text-primary">
                  {erectionLastUpdated ? new Date(erectionLastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </dd>
              </div>
            </dl>
            <p className={`mt-2 text-[11px] font-medium ${isAssignedErectionManager ? 'text-success' : canManage ? 'text-info' : 'text-text-muted'}`}>
              {erectionViewerRelationLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/${id}/workflow/erection/method-statement`}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
              erectionStep2Ready
                ? 'border border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-secondary'
                : 'bg-accent text-white hover:bg-accent/90'
            }`}
          >
            Step 1: Issue Erection Method Statement
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
          </Link>
          {erectionStep2Ready ? (
            <Link
              href={`/contracts/${id}/workflow/erection/method-statement/approval`}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                erectionStep3Ready
                  ? 'border border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-secondary'
                  : 'bg-accent text-white hover:bg-accent/90'
              }`}
            >
              Step 2: Erection Method Statement Approval
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          ) : canManage ? (
            <PreviewScreenAction
              href={`/contracts/${id}/workflow/erection/method-statement/approval`}
              label="Step 2: Erection Method Statement Approval"
              waitingLabel="Waiting for Step 1"
            />
          ) : null}
          {erectionStep3Ready ? (
            <Link
              href={`/contracts/${id}/workflow/erection/schedule`}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                erectionStep4Ready
                  ? 'border border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-secondary'
                  : 'bg-accent text-white hover:bg-accent/90'
              }`}
            >
              Step 3: Issue Erection Schedule
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          ) : canManage ? (
            <PreviewScreenAction
              href={`/contracts/${id}/workflow/erection/schedule`}
              label="Step 3: Issue Erection Schedule"
              waitingLabel="Waiting for Approval"
            />
          ) : null}
          {erectionStep4Ready ? (
            <Link
              href={`/contracts/${id}/workflow/erection/delivery-start`}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                erectionDeliveryStart?.status === 'HOLD' || erectionDeliveryStart?.status === 'RETURNED'
                  ? 'border border-warning bg-warning-light text-warning hover:bg-warning-light/70'
                  : erectionStep5Ready
                    ? 'border border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-secondary'
                    : 'bg-accent text-white hover:bg-accent/90'
              }`}
            >
              Step 4: Delivery Start
              {(erectionDeliveryStart?.status === 'HOLD' || erectionDeliveryStart?.status === 'RETURNED') && ' (Needs Attention)'}
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          ) : canManage ? (
            <PreviewScreenAction
              href={`/contracts/${id}/workflow/erection/delivery-start`}
              label="Step 4: Delivery Start"
              waitingLabel="Waiting for Schedule"
            />
          ) : null}
          {erectionStep5Ready ? (
            <Link
              href={`/contracts/${id}/workflow/erection/start`}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                erectionStart?.status === 'HOLD' || erectionStart?.status === 'RETURNED'
                  ? 'border border-warning bg-warning-light text-warning hover:bg-warning-light/70'
                  : erectionStep6Ready
                    ? 'border border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-secondary'
                    : 'bg-accent text-white hover:bg-accent/90'
              }`}
            >
              Step 5: Erection Start
              {(erectionStart?.status === 'HOLD' || erectionStart?.status === 'RETURNED') && ' (Needs Attention)'}
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          ) : canManage ? (
            <PreviewScreenAction
              href={`/contracts/${id}/workflow/erection/start`}
              label="Step 5: Erection Start"
              waitingLabel="Waiting for Delivery"
            />
          ) : null}
          {erectionStep6Ready ? (
            <Link
              href={`/contracts/${id}/workflow/erection/checklist`}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
                erectionChecklist?.status === 'VERIFIED'
                  ? 'border border-success bg-success-light text-success hover:bg-success-light/70'
                  : erectionChecklist?.status === 'SUBMITTED_FOR_VERIFICATION'
                    ? 'border border-info bg-info-light text-info hover:bg-info-light/70'
                    : erectionChecklist?.status === 'HOLD' || erectionChecklist?.status === 'RETURNED'
                      ? 'border border-warning bg-warning-light text-warning hover:bg-warning-light/70'
                      : 'bg-accent text-white hover:bg-accent/90'
              }`}
            >
              Step 6: Erection Checklist
              {erectionChecklist?.status === 'VERIFIED' && ' (Verified)'}
              {erectionChecklist?.status === 'SUBMITTED_FOR_VERIFICATION' && ' (Pending Verification)'}
              {(erectionChecklist?.status === 'HOLD' || erectionChecklist?.status === 'RETURNED') && ' (Needs Attention)'}
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          ) : canManage ? (
            <PreviewScreenAction
              href={`/contracts/${id}/workflow/erection/checklist`}
              label="Step 6: Erection Checklist"
              waitingLabel="Waiting for Erection Start"
            />
          ) : null}
        </div>
      </section>

      {/* CM-71H.10 — one clear place for a manager-tier viewer to preview all
          6 guided erection screens for a presentation/design review,
          regardless of real workflow status — distinct from the step-button
          row above, whose "Preview Screen" fallback only appears per-step
          once that step isn't ready yet. Never shown to a staff-tier viewer
          (canManage-gated) — their My Tasks / Erection Dashboard workflow is
          completely unaffected. */}
      {canManage && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-accent shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-text-primary">Erection Workflow Screens Preview</h2>
          </div>
          <p className="text-xs text-text-secondary mt-1 mb-3">
            Preview mode is for layout and management review only. Save and submit actions are disabled until previous workflow steps are completed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ERECTION_STEP_PREVIEW_SCREENS.map((s) => (
              <div key={s.step} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-secondary/30 px-3 py-2.5">
                <span className="text-xs font-medium text-text-primary">{s.label}</span>
                <Link
                  href={`/contracts/${id}/workflow/erection/${s.path}?preview=1`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  <Eye className="size-3 shrink-0" aria-hidden="true" />
                  Preview Screen
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <ErectionWorkflowAssignmentCard
        contractId={id}
        assignment={erectionAssignment}
        people={people}
        canManage={canManage}
      />

      {/* Workflow Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Workflow Status</h2>
          <a
            href={`?myTasksOnly=${myTasksOnly ? 'false' : 'true'}`}
            className={`text-[11px] rounded-full px-2.5 py-1 font-medium border ${myTasksOnly ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:border-border-strong'}`}
          >
            My Tasks only
          </a>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-muted">Overall Status</dt>
            <dd className="mt-0.5"><WorkflowStatusBadge status={progress.workflowStatus} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Total Tasks</dt>
            <dd className="font-medium text-text-primary mt-0.5">{progress.total}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Completed</dt>
            <dd className="font-medium text-text-primary mt-0.5">{progress.completed}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">In Progress</dt>
            <dd className="font-medium text-text-primary mt-0.5">{progress.inProgress}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Overdue</dt>
            <dd className="font-medium text-text-primary mt-0.5">
              {progress.overdue > 0 ? <span className="text-error">{progress.overdue}</span> : 0}
            </dd>
          </div>
        </dl>
      </section>

      {/* Workflow Progress Board */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Workflow Progress Board</h2>
        <WorkflowBoard
          contractId={id}
          tasks={tasks}
          people={people}
          canManage={canManage}
          canUpdateAssigned={canUpdateAssigned}
          currentUserId={currentUserId}
          contractReference={contract.referenceNumber}
          contractTitle={contract.title}
          {...(myTasksOnly ? { emptyMessage: 'No tasks assigned to you on this contract.' } : {})}
        />
      </section>
    </div>
  );
}

/**
 * CM-71H.9 — Manager Preview Mode. Shown instead of the real Step N action
 * button when that step isn't ready yet, for a manager-tier viewer only
 * (see the 5 call sites below, each gated by `canManage`) — a real,
 * clickable link into the step's own screen with `?preview=1`, never a
 * disabled/dead button. Staff-tier keeps the exact pre-existing behavior of
 * simply not showing a button at all for a not-yet-ready step.
 */
function PreviewScreenAction({ href, label, waitingLabel }: { href: string; label: string; waitingLabel: string }): React.JSX.Element {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-secondary/40 px-3 py-1.5 text-xs">
      <span className="text-text-muted">{label} — {waitingLabel}</span>
      <Link
        href={`${href}?preview=1`}
        className="inline-flex items-center gap-1 font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-focus rounded"
      >
        <Eye className="size-3 shrink-0" aria-hidden="true" />
        Preview Screen
      </Link>
    </div>
  );
}
