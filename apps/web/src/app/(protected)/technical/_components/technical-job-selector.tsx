'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { TechnicalJobRow, BoqConfirmationItem, JobReleaseSummary } from '@/lib/technical-api';
import { getContractBoqProgressForDashboardAction } from '../../contracts/actions';
import { searchJobsLocally, fiveStepFlow, selectedJobBoqSummary, releaseFlow, releaseCounts, jobReleaseNote, RELEASE_MESSAGES } from '../_lib/technical-dashboard-selector-helpers';
import { STAGE_ACTION_LABELS, STAGE_LABELS, stageHref } from '../_lib/technical-format';

// ---------------------------------------------------------------------------
// FMP-UI-31 — the Technical Dashboard's one client component. Owns the
// selected-job state the search box and the Selected Job Progress card
// share. Search runs entirely against the `jobs` list already fetched
// server-side for the dashboard (no network call — see
// `searchJobsLocally()`'s own doc comment); only the per-job BOQ summary is
// fetched on demand, reusing the exact same read-only server action the
// Contract Management dashboard already added (FMP-UI-29) — generic, works
// for any contract id, nothing Technical-specific added to it.
// ---------------------------------------------------------------------------

interface TechnicalJobSelectorProps {
  jobs: TechnicalJobRow[];
  initialJob: TechnicalJobRow | null;
  initialBoqItems: BoqConfirmationItem[] | null;
  /** FMP-BOQ-16 — drawing group / release numbers per started job. */
  releaseByContract: Record<string, JobReleaseSummary>;
}

function jobNextActionLabel(job: TechnicalJobRow): string {
  if (!job.workflowStarted) return 'Start Technical Workflow';
  if (job.status === 'COMPLETED') return 'Technical complete';
  return job.currentStage ? STAGE_ACTION_LABELS[job.currentStage] : '—';
}

function jobStageLabel(job: TechnicalJobRow): string {
  if (!job.workflowStarted) return 'Not Started';
  if (job.status === 'COMPLETED') return 'Completed';
  return job.currentStage ? STAGE_LABELS[job.currentStage] : '—';
}

/** Where "Open Stage" should go — same rule the jobs table and Needs Attention panel use. */
function openStageHref(job: TechnicalJobRow): string {
  if (job.workflowStarted && job.currentStage && job.status !== 'COMPLETED') {
    return stageHref(job.contractId, job.currentStage);
  }
  return `/technical/jobs/${job.contractId}`;
}

export function TechnicalJobSelector({ jobs, initialJob, initialBoqItems, releaseByContract }: TechnicalJobSelectorProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TechnicalJobRow | null>(initialJob);
  const [boqItems, setBoqItems] = useState<BoqConfirmationItem[] | null>(initialBoqItems);
  const [loadingBoq, setLoadingBoq] = useState(false);

  const results = searchJobsLocally(jobs, query);

  function selectJob(job: TechnicalJobRow): void {
    setSelected(job);
    setQuery('');
    setLoadingBoq(true);
    getContractBoqProgressForDashboardAction(job.contractId)
      .then((items) => setBoqItems(items))
      .finally(() => setLoadingBoq(false));
  }

  const steps = selected ? fiveStepFlow(selected) : [];
  const boq = selectedJobBoqSummary(boqItems);
  const release = selected ? releaseByContract[selected.contractId] : undefined;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Select Contract / Project</h2>
      <div className="relative mt-2 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contract no., job order, or project name"
          aria-label="Search contract or project"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
        />
        {query.trim().length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">No jobs match &ldquo;{query}&rdquo;.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto divide-y divide-border">
                {results.slice(0, 8).map((j) => (
                  <li key={j.contractId}>
                    <button
                      type="button"
                      onClick={() => selectJob(j)}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <span className="font-medium text-text-primary">{j.projectName}</span>
                      <span className="text-xs text-text-muted">{j.jobOrderNo ?? j.referenceNumber}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {!selected ? (
        <p className="mt-3 text-sm text-text-muted">No Technical jobs to select yet.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-text-muted">Contract No.</dt><dd className="font-medium text-text-primary">{selected.referenceNumber}</dd></div>
            <div><dt className="text-xs text-text-muted">Project Name</dt><dd className="truncate font-medium text-text-primary">{selected.projectName}</dd></div>
            <div><dt className="text-xs text-text-muted">Job Order</dt><dd className="font-medium text-text-primary">{selected.jobOrderNo ?? '—'}</dd></div>
            <div><dt className="text-xs text-text-muted">Current Stage</dt><dd className="font-medium text-text-primary">{jobStageLabel(selected)}</dd></div>
            <div><dt className="text-xs text-text-muted">Next Action</dt><dd className="font-medium text-text-primary">{jobNextActionLabel(selected)}</dd></div>
            <div><dt className="text-xs text-text-muted">Due / Planned</dt><dd className="font-medium text-text-primary">{selected.dueDate ? selected.dueDate.slice(0, 10) : '—'}</dd></div>
            <div><dt className="text-xs text-text-muted">Owner</dt><dd className="truncate font-medium text-text-primary">{selected.assignedTo ?? '—'}</dd></div>
            <div><dt className="text-xs text-text-muted">Status</dt><dd className="font-medium text-text-primary">{selected.status ?? 'Not Started'}</dd></div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={openStageHref(selected)}
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              Open Stage
            </Link>
            <Link
              href={`/contracts/${selected.contractId}`}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
            >
              Open Contract
            </Link>
          </div>

          {/* Selected Job Progress */}
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Selected Job Progress</h3>
            <ol className="mt-3 flex flex-wrap items-center gap-1">
              {steps.map((step, i) => (
                <li key={step.key} className="flex items-center gap-1">
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                      step.state === 'done' ? 'bg-success-light text-success' : step.state === 'current' ? 'bg-accent-light text-accent' : 'bg-surface-secondary text-text-muted',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                  {i < steps.length - 1 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
                </li>
              ))}
            </ol>

            <div className="mt-3">
              {loadingBoq ? (
                <p className="text-sm text-text-muted">Loading BOQ summary…</p>
              ) : boq.emptyMessage ? (
                <p className="text-sm text-text-muted">{boq.emptyMessage}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="rounded-lg bg-surface-secondary px-3 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{boq.boqItemCount}</p>
                    <p className="text-[11px] text-text-secondary">BOQ Items</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-3 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{boq.confirmedPieces}</p>
                    <p className="text-[11px] text-text-secondary">Drawing Confirmed Pieces</p>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-3 py-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{boq.piecesGenerated}</p>
                    <p className="text-[11px] text-text-secondary">Pieces Generated</p>
                  </div>
                  {boq.needsAttention && (
                    <span className="inline-flex items-center rounded-full bg-warning-light px-2.5 py-1 text-xs font-semibold text-warning">
                      Needs Attention
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* FMP-BOQ-16 — Technical release: what Technical still has to finish before Production can start. Read-only. */}
            <div className="mt-4 rounded-lg border border-border px-3 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Technical Release</h4>
              {!release ? (
                <p className="mt-2 text-sm text-text-muted">{RELEASE_MESSAGES.noBoq}</p>
              ) : (
                <>
                  <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs" aria-label="Technical release flow">
                    {releaseFlow(release).map((step, i) => (
                      <li key={step.key} className="flex items-center gap-1">
                        {i > 0 && <span aria-hidden="true" className="text-text-muted">→</span>}
                        <span className="rounded-md bg-surface-secondary px-2 py-1">
                          <span className="text-text-secondary">{step.label}</span>{' '}
                          <span className="font-semibold tabular-nums text-text-primary">{step.count}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    {releaseCounts(release).map((c) => (
                      <div key={c.label} className="flex justify-between gap-2">
                        <dt className="text-text-secondary">{c.label}</dt>
                        <dd className={`font-semibold tabular-nums ${c.warn ? 'text-warning' : 'text-text-primary'}`}>{c.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {jobReleaseNote(release) && <p className="mt-2 text-xs text-text-muted">{jobReleaseNote(release)}</p>}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
