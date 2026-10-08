import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ClipboardList,
  FileInput,
  Calculator,
  Hourglass,
  BadgeCheck,
  PackageCheck,
  AlertTriangle,
  Ruler,
  ArrowUpRight,
  ClipboardCheck,
} from 'lucide-react';
import { technicalApiFetchResult, TECHNICAL_STAGE_LABELS, fetchBoqConfirmations } from '@/lib/technical-api';
import type { TechnicalDashboardData, TechnicalJobRow, TechnicalStage } from '@/lib/technical-api';
import { RefreshButton } from './_components/refresh-button';
import { RecentActivityPanel } from './_components/recent-activity-panel';
import { StageProgressOverview } from './_components/stage-progress-overview';
import { NextActionPanel } from './_components/next-action-panel';
import { TechnicalJobSelector } from './_components/technical-job-selector';
import { DashboardKpiCard } from '../_components/dashboard-kpi-card';
import type { DashboardKpiTone } from '../_components/dashboard-kpi-card';
import { DashboardNeedsAttentionPanel } from '../_components/dashboard-needs-attention-panel';
import { formatDate, stageBadgeClasses, STAGE_ACTION_LABELS } from './_lib/technical-format';
import { pickDefaultTechnicalJob, buildTechnicalNeedsAttentionRows, buildReleaseAttentionRows, jobReleaseIndicator, prioritizeJobsForTable } from './_lib/technical-dashboard-selector-helpers';

// FMP-TECH-05P — Job Order No display-priority fallback: prefer the
// human-readable Job Order No, then the contract's own reference/quotation
// number (always present on a real Contract row), then a short readable
// note, and only "—" if a row genuinely has neither (should not happen in
// practice, since `referenceNumber` is a required field on every Contract —
// this is defensive, not a case the real data is expected to hit).
function jobOrderDisplay(job: Pick<TechnicalJobRow, 'jobOrderNo' | 'referenceNumber'>): string {
  if (job.jobOrderNo) return job.jobOrderNo;
  if (job.referenceNumber) return job.referenceNumber;
  return 'Contract Ref Available';
}

export const metadata: Metadata = { title: 'Technical Dashboard — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// FMP-TECH-01C — Technical Dashboard, redesigned as a real workflow control
// center. Root cause of the previous "too simple/placeholder-like" page:
// `/contracts/technical` (the OLD FMP-UI-07 Executive Module Landing Page,
// now redirected here) had no dedicated backend, so it computed its 4 tiles
// from the Platform Dashboard's own generic per-module card endpoint and
// hardcoded "Not available yet" for Needs Attention/Recent Activity because
// no real data source existed for either. This page instead reads the ONE
// real Technical dashboard endpoint built in FMP-TECH-01
// (`GET /technical/dashboard`) — every number and row below is real
// TechnicalWorkflow/TechnicalDrawing/TechnicalWorkflowActivity data, never a
// placeholder.
//
// FMP-TECH-05 — visual polish pass into a "Technical Control Center": KPI
// tiles gained icon chips/tints/helper text, Stage Progress became a
// numbered 4-step indicator, a new Next Action Focus panel sits beside it,
// the jobs table gained stage/status badges and grouped action buttons, and
// Needs Attention/Recent Activity became timeline-style panels. Same single
// `GET /technical/dashboard` call as before — only the `stage` field was
// added to each Needs Attention item (see technical.service.ts) so a badge
// could be shown without a second lookup; no other data-shape change.
// ---------------------------------------------------------------------------

// FMP-TECH-05Q — short table-only stage labels (the jobs table's own
// column is narrow; `TECHNICAL_STAGE_LABELS` elsewhere stays full-length
// for the stepper/stage pages/badges where there's room). The full label
// is still available via the badge's own `title` attribute.
const TABLE_STAGE_LABELS: Record<TechnicalStage, string> = {
  DRAWING_RECEIVED: 'Drawing Received',
  SD_CALCULATION_SUBMISSION: 'SD & Calc.',
  GETTING_APPROVAL: 'Getting Approval',
  FD_ISSUANCE: 'FD Issuance',
};

function jobStageLabel(job: TechnicalJobRow): string {
  if (!job.workflowStarted) return 'Not Started';
  if (job.status === 'COMPLETED') return 'Completed';
  return job.currentStage ? TABLE_STAGE_LABELS[job.currentStage] : '—';
}

function jobStageTitle(job: TechnicalJobRow): string | undefined {
  return job.workflowStarted && job.status !== 'COMPLETED' && job.currentStage
    ? TECHNICAL_STAGE_LABELS[job.currentStage]
    : undefined;
}

function jobStageBadgeClasses(job: TechnicalJobRow): string {
  if (!job.workflowStarted) return 'bg-surface-secondary text-text-muted';
  if (job.status === 'COMPLETED') return 'bg-success-light text-success';
  return job.currentStage ? stageBadgeClasses(job.currentStage) : 'bg-surface-secondary text-text-muted';
}

// FMP-TECH-05Q — shortened to the ticket's own recommended table wording.
// FMP-UI-31 — moved to `_lib/technical-format.ts` (STAGE_ACTION_LABELS) so
// the redesigned Next Action Focus panel can use the exact same wording
// instead of its own separate copy.

function jobNextActionLabel(job: TechnicalJobRow): string {
  if (!job.workflowStarted) return 'Start Technical Workflow';
  if (job.status === 'COMPLETED') return 'Technical complete';
  return job.currentStage ? STAGE_ACTION_LABELS[job.currentStage] : '—';
}

// FMP-TECH-05Q — a genuinely overdue row (real `dueDate` in the past, not
// yet completed) is a real, useful signal — not fake data, just a
// comparison against a field the row already carries. "Returned" (the
// ticket's other suggested status) isn't implemented: `TechnicalJobRow`
// doesn't carry FD Issuance's own `RETURNED_REOPENED` sub-status, and
// adding it would require a backend response-shape change, out of scope
// for this UI-only ticket.
function jobStatusDisplay(job: TechnicalJobRow): { label: string; classes: string } {
  if (job.status === 'COMPLETED') return { label: 'Completed', classes: 'bg-success-light text-success' };
  if (!job.workflowStarted) return { label: 'Not Started', classes: 'bg-surface-secondary text-text-muted' };
  const isOverdue = job.dueDate !== null && new Date(job.dueDate).getTime() < Date.now();
  if (isOverdue) return { label: 'Overdue', classes: 'bg-error-light text-error' };
  return { label: 'In Progress', classes: 'bg-module-technical-light text-module-technical' };
}

// FMP-TECH-05Q — `assignedTo` display names in this data set can run long
// (e.g. "[UAT] Manager (CM-01 / ALL_DEPARTMENTS for Incidents+Contracts)");
// the parenthetical is department/scope detail, not the name itself, so the
// table shows only the part before it — the full string stays available via
// `title` for anyone who wants it.
function shortOwnerName(name: string | null): string | null {
  if (!name) return null;
  const parenIndex = name.indexOf('(');
  return parenIndex === -1 ? name : name.slice(0, parenIndex).trim();
}

/** Where "Open Current Stage" should go — the stage's own screen if one exists and it's still open, otherwise the workflow overview, which shows the real current/next stage (and, once complete, the completion banner) rather than 404ing. */
function openCurrentStageHref(job: TechnicalJobRow): string {
  if (job.workflowStarted && job.currentStage === 'DRAWING_RECEIVED') {
    return `/technical/jobs/${job.contractId}/workflow/drawing-received`;
  }
  if (job.workflowStarted && job.currentStage === 'SD_CALCULATION_SUBMISSION') {
    return `/technical/jobs/${job.contractId}/workflow/sd-calculation-submission`;
  }
  if (job.workflowStarted && job.currentStage === 'GETTING_APPROVAL') {
    return `/technical/jobs/${job.contractId}/workflow/getting-approval`;
  }
  if (job.workflowStarted && job.currentStage === 'FD_ISSUANCE' && job.status !== 'COMPLETED') {
    return `/technical/jobs/${job.contractId}/workflow/fd-issuance`;
  }
  return `/technical/jobs/${job.contractId}`;
}

function errorMessage(status: number): string {
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to view Technical Dashboard.';
  return 'Technical dashboard data could not be loaded. Please try again.';
}

// FMP-UI-35 — this page's own accent vocabulary (unchanged, still carries
// real meaning distinctions — e.g. "info" vs "success" vs "error"), mapped
// onto the shared DashboardKpiCard's smaller tone set below. Kept local
// now that the dedicated `TechnicalKpiCard` component (which used to own
// this type) is retired.
type TechnicalKpiAccent = 'neutral' | 'info' | 'secondary' | 'warning' | 'module' | 'success' | 'error';
const TECHNICAL_ACCENT_TONE: Record<TechnicalKpiAccent, DashboardKpiTone> = {
  neutral: 'neutral', info: 'neutral', secondary: 'neutral', module: 'neutral',
  warning: 'warning', success: 'success', error: 'error',
};

interface KpiDef {
  label: string;
  value: number | undefined;
  icon: typeof ClipboardList;
  accent: TechnicalKpiAccent;
}

export default async function TechnicalDashboardPage(): Promise<React.JSX.Element> {
  const result = await technicalApiFetchResult<TechnicalDashboardData>('/technical/dashboard');

  const dashboard = result.data;
  const loadError = result.error;

  const metrics = dashboard?.metrics;
  const hasData = dashboard !== null;
  const needsAttentionCount = metrics?.needsAttention ?? 0;

  // FMP-TECH-05P — reduced from 6 distinct accent colors down to 3:
  // neutral (not-yet-started / on-track), a single shared "active stage"
  // tint for all 4 in-progress cards (was info/secondary/warning/module —
  // 4 different colors competing for attention with no real meaning
  // difference between them), and the 2 cards that should actually stand
  // out keep their own strong color (success / error-when-active).
  const kpis: KpiDef[] = [
    { label: 'Pending Technical Review', value: metrics?.pendingTechnicalReview, icon: ClipboardList, accent: 'neutral' },
    { label: 'Drawing Received', value: metrics?.drawingReceived, icon: FileInput, accent: 'info' },
    { label: 'SD & Calculation Pending', value: metrics?.sdCalculationPending, icon: Calculator, accent: 'info' },
    { label: 'Waiting Approval', value: metrics?.waitingApproval, icon: Hourglass, accent: 'info' },
    { label: 'FD Issued', value: metrics?.fdIssued, icon: BadgeCheck, accent: 'info' },
    // FMP-UI-31 — "Ready for Production Release" → "Ready for Production",
    // "Needs Attention / Overdue" → "Needs Attention", per this unit's own
    // exact required KPI label list.
    { label: 'Ready for Production', value: metrics?.readyForProductionRelease, icon: PackageCheck, accent: 'success' },
    { label: 'Needs Attention', value: metrics?.needsAttention, icon: AlertTriangle, accent: needsAttentionCount > 0 ? 'error' : 'neutral' },
  ];

  // FMP-UI-31 — Contract/Project selector's default pick + its BOQ summary,
  // fetched once, server-side (the same reused server-independent function
  // the per-contract BOQ Progress tab already uses). Jobs table reordered
  // (not filtered) so a flagged/urgent job always appears inside the first
  // 5 rows, then capped to 5, per this unit's own "max 5 rows" requirement.
  const defaultJob = dashboard ? pickDefaultTechnicalJob(dashboard.jobs, dashboard.needsAttention) : null;
  const initialBoqItems = defaultJob ? await fetchBoqConfirmations(defaultJob.contractId) : null;
  const jobsForTable = dashboard ? prioritizeJobsForTable(dashboard.jobs, dashboard.needsAttention).slice(0, 5) : [];
  const releaseByContract = dashboard?.releaseByContract ?? {};
  const attentionRows = dashboard
    ? [...buildTechnicalNeedsAttentionRows({
        needsAttention: dashboard.needsAttention,
        waitingApproval: dashboard.metrics.waitingApproval,
        missingBoqConfirmation: dashboard.boqAttention.missingBoqConfirmation,
        confirmedPiecesNotGenerated: dashboard.boqAttention.confirmedPiecesNotGenerated,
        rejectedOrHoldPieces: dashboard.boqAttention.rejectedOrHoldPieces,
      }), ...buildReleaseAttentionRows(releaseByContract)]
    : [];

  return (
    // FMP-UI-31 — widened max-w-7xl (1280px) → max-w-[1600px] for "use full
    // available width" (was leaving visible empty space on wide desktop
    // screens, the same complaint the Contract Management dashboard had,
    // FMP-UI-29); vertical rhythm trimmed slightly (py-6→py-5,
    // space-y-5→space-y-4) to help the new selector section fit without
    // pushing the page into scrolling.
    <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5 lg:px-8">
      {/* Header — FMP-UI-35: icon simplified from a colored badge down to a
          plain icon (same treatment the other 4 piece-flow dashboards now
          use); action buttons sized `h-9` consistently (were bare
          `px-3 py-1.5`, a slightly different height than the other 4's
          buttons); "Contract List" renamed "View Contract List" to match
          the wording every other dashboard already uses. Bordered card,
          Refresh, and Back to Platform Dashboard were already present and
          unchanged — this page was closest to the shared pattern already. */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Ruler className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Technical Dashboard</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                Live workflow data
              </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Track drawings, calculations, approvals, and production release.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <RefreshButton />
          <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            Back to Platform Dashboard
          </Link>
          <Link href="/contracts" className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-text-secondary hover:bg-surface-secondary">
            View Contract List
          </Link>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          {errorMessage(loadError.status)}
        </div>
      )}

      {/* KPI cards — FMP-UI-35: now the shared DashboardKpiCard every
          piece-flow dashboard uses (was the Technical-only `TechnicalKpiCard`
          — bigger padding, a colored icon chip, a 3rd helper-text line,
          smaller numbers/bigger labels than the other 4 dashboards' own
          cards). `TECHNICAL_ACCENT_TONE` maps this page's own 7-accent
          vocabulary (kept as-is, still used for nothing else) onto the
          shared component's 4 tones — "info"/"secondary"/"module" (this
          page's "in progress, not yet alarming" accents) all read as
          `neutral`, the same way Production/Storage/Erection's own
          in-progress KPI cards already do. */}
      <section aria-labelledby="technical-kpi-heading" className="space-y-3">
        <h2 id="technical-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {kpis.map((kpi) => (
            <DashboardKpiCard
              key={kpi.label}
              label={kpi.label}
              value={hasData ? kpi.value ?? 0 : null}
              icon={kpi.icon}
              tone={TECHNICAL_ACCENT_TONE[kpi.accent]}
            />
          ))}
        </div>
      </section>

      {/* FMP-UI-31 — Contract/Project selector + Selected Job Progress, full
          width below the KPI row (this unit's own "Alternative" layout —
          the 6-figure stage flow + BOQ summary needs more room than a 65%
          column would give it). Selecting a job never navigates away;
          "Open Stage"/"Open Contract" are the only links that do. */}
      {hasData && (
        <TechnicalJobSelector jobs={dashboard.jobs} initialJob={defaultJob} initialBoqItems={initialBoqItems} releaseByContract={releaseByContract} />
      )}

      {/* Stage progress + next action focus */}
      {hasData && (
        <section aria-labelledby="technical-stage-heading" className="space-y-3">
          <h2 id="technical-stage-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Stage Progress Overview
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <StageProgressOverview stageBreakdown={dashboard.stageBreakdown} />
            <NextActionPanel dashboard={dashboard} />
          </div>
        </section>
      )}

      {/* Jobs table — FMP-UI-31: capped to 5 rows (was every job in scope,
          up to 50). No "View all technical jobs" link: no full jobs list
          page exists yet (only the per-job detail route), so per this
          unit's own "do not add a broken button" instruction, none was
          added — see progress-tracker.md for this decision. */}
      <section aria-labelledby="technical-jobs-heading" className="space-y-3">
        <h2 id="technical-jobs-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Technical Workflow Jobs
        </h2>

        {jobsForTable.length === 0 && !loadError ? (
          <div className="rounded-lg border border-border bg-surface p-10 text-center">
            <ClipboardCheck className="mx-auto size-8 text-text-muted" aria-hidden="true" />
            <p className="mt-3 text-base font-medium text-text-primary">No Technical workflow jobs yet</p>
            <p className="mt-1 text-sm text-text-secondary">Start a Technical workflow from an active contract/job order.</p>
            <Link
              href="/contracts"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Go to Contract List
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            {/* FMP-TECH-05Q — compacted from 9 columns to the ticket's own
                recommended 7: Job Order No + Project/Client merged into one
                "Job / Project" column (3 lines), Priority dropped as a
                separate column (it added a 7th competing badge per row with
                no room reserved for it in the new layout — URGENT/HIGH jobs
                already surface through the Needs Attention panel and KPI
                card above). Row padding tightened `py-3.5` → `py-3`. */}
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-2.5">Job / Project</th>
                  <th className="px-4 py-2.5">Current Stage</th>
                  <th className="px-4 py-2.5">Next Action</th>
                  <th className="px-4 py-2.5">Due / Planned</th>
                  <th className="px-4 py-2.5">Owner</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobsForTable.map((job) => {
                  const status = jobStatusDisplay(job);
                  const ownerShort = shortOwnerName(job.assignedTo);
                  return (
                    <tr key={job.contractId} className="hover:bg-surface-secondary/60">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold leading-snug text-text-primary">{jobOrderDisplay(job)}</p>
                        <p className="mt-0.5 text-xs font-medium leading-snug text-text-secondary">{job.projectName}</p>
                        <p className="text-[11px] leading-snug text-text-muted">{job.clientEmployer}</p>
                        {jobReleaseIndicator(releaseByContract[job.contractId]) && (
                          <p className="text-[11px] font-medium leading-snug text-text-secondary">{jobReleaseIndicator(releaseByContract[job.contractId])}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          title={jobStageTitle(job)}
                          className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${jobStageBadgeClasses(job)}`}
                        >
                          {jobStageLabel(job)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{jobNextActionLabel(job)}</td>
                      <td className="px-4 py-3 text-text-muted">{job.dueDate ? formatDate(job.dueDate) : '—'}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {ownerShort ? (
                          <span title={ownerShort !== job.assignedTo ? job.assignedTo! : undefined}>{ownerShort}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.classes}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-1">
                          {/* FMP-TECH-05Q — a plain text-button (no fill,
                              no border) instead of the FMP-TECH-05P
                              bordered/tinted button, so the primary action
                              reads as subtle and un-repetitive down a long
                              column of rows, matching the "Open" link style
                              Needs Attention/Recent Activity already use. */}
                          <Link
                            href={openCurrentStageHref(job)}
                            className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline"
                          >
                            {job.workflowStarted ? 'Open Stage' : 'Start Technical Workflow'}
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/technical/jobs/${job.contractId}`}
                              className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-secondary"
                            >
                              Workflow
                            </Link>
                            <Link
                              href={`/contracts/${job.contractId}`}
                              className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-secondary"
                            >
                              Contract
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Needs Attention + Recent Activity */}
      {hasData && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section aria-labelledby="technical-attention-heading" className="space-y-3">
            <h2 id="technical-attention-heading" className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Needs Attention
            </h2>
            <DashboardNeedsAttentionPanel rows={attentionRows} />
          </section>

          <section aria-labelledby="technical-activity-heading" className="space-y-3">
            <h2 id="technical-activity-heading" className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Recent Technical Activity
            </h2>
            {/* FMP-TECH-05P — latest 5 only, so this panel never grows
                taller than Needs Attention beside it; the backend already
                returns up to 10 (see technical.service.ts's getDashboard),
                so a plain note replaces a "View all activity" link since no
                dedicated activity page/modal exists to link to. */}
            <RecentActivityPanel activities={dashboard.recentActivities.slice(0, 5)} />
            {dashboard.recentActivities.length > 5 && (
              <p className="text-center text-xs text-text-muted">Showing latest 5 activities</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
