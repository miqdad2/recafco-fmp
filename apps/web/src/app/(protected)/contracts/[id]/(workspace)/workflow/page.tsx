import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getCurrentUserContext } from '../../../_lib/get-user-permissions';
import { WorkflowBoard } from '../../../workflow/_components/workflow-board';
import { WorkflowStatusBadge } from '../../../workflow/_components/workflow-status-badge';
import { WorkflowPollingRefresher } from '../../../workflow/_components/workflow-polling-refresher';

export const metadata: Metadata = { title: 'Workflow & Team Tasks — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContractWorkflowTab({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const search = await searchParams;
  const myTasksOnly = search['myTasksOnly'] === 'true';

  const [{ id: currentUserId, permissions }, workflow, people] = await Promise.all([
    getCurrentUserContext(),
    contractsApi.getWorkflow(id, { myTasksOnly }).catch(() => null),
    contractsApi.people().catch(() => []),
  ]);
  if (!workflow) notFound();

  const canManage = permissions.includes('contracts.update');
  const canUpdateAssigned = permissions.includes('contracts.workflow_update');
  const { tasks, progress, contract } = workflow;
  const generatedAt = new Date().toLocaleTimeString('en-GB');

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
              {progress.overdue > 0 ? <span className="text-danger">{progress.overdue}</span> : 0}
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
