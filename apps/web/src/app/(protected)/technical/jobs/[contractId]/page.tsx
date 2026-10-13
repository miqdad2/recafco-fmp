import type { Metadata } from 'next';
import Link from 'next/link';
import { Ruler } from 'lucide-react';
import { startTechnicalWorkflowFormAction } from '../../actions';
import { priorityLabel } from '../../_lib/technical-format';
import { loadTechnicalJob } from '../../_lib/technical-job-data';
import { TechnicalStepOverview } from '../../_components/technical-step-overview';
import { TechnicalJobUnavailableView } from '../../_components/technical-job-unavailable';

export const metadata: Metadata = { title: 'Technical Details — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ contractId: string }>;
}

// ---------------------------------------------------------------------------
// FMP-TECH-23 — Technical Details is the overview of one job: summary, the
// current step with one Continue button, and the five step cards. The actual
// work happens on one focused page per step (`./step/[step]`), never all
// together here. Every update control lives on those pages behind the existing
// `canWrite`; the old four-stage pages stay only for legacy records.
// ---------------------------------------------------------------------------

export default async function TechnicalJobPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { contractId } = await params;
  const job = await loadTechnicalJob(contractId);
  if (!job.ok) return <TechnicalJobUnavailableView info={job.unavailable} />;
  const { contract, workflow, canWrite, guided } = job;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 px-5 py-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-xs text-text-muted">
        <Link href="/contracts" className="hover:text-text-secondary hover:underline">Contract Management</Link>
        {' > '}
        <Link href="/technical" className="hover:text-text-secondary hover:underline">Technical Dashboard</Link>
        {' > '}
        <span>Job Order {contract.jobOrder ?? contract.referenceNumber}</span>
        {' > '}
        <span className="text-text-secondary">Technical Details</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
            <Ruler className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Technical Details</h1>
            <p className="text-sm text-text-secondary">Review BOQ drawings, confirm elements, manage drawing groups, and release to Production.</p>
            <p className="text-xs text-text-muted">Job Order {contract.jobOrder ?? '—'} — {contract.title}</p>
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

      {/* Project / Contract Summary */}
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

      {/* Start Technical Work — only before work has started; stays on this page. */}
      {!workflow && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Technical work has not started for this job order.</p>
            <p className="text-xs text-text-secondary">
              {canWrite ? 'Start Technical work to begin with the BOQ drawings.' : 'Contact a Contract Manager to start this job order’s Technical work.'}
            </p>
          </div>
          {canWrite && (
            <form action={startTechnicalWorkflowFormAction.bind(null, contractId)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                Start Technical Work
              </button>
            </form>
          )}
        </div>
      )}

      {/* Current step, Continue button and the five step cards */}
      <TechnicalStepOverview contractId={contractId} guided={guided} canWrite={canWrite} />
    </div>
  );
}
