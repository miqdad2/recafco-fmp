import Link from 'next/link';
import type { ContractWorkflowDetail } from '@/lib/contracts-api';
import { formatScopeSummary } from '../../_lib/contract-ui-helpers';
import { WorkflowStatusBadge } from './workflow-status-badge';

interface Props {
  detail: ContractWorkflowDetail;
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  TERMINATED: 'Terminated',
  CLOSED: 'Closed',
};

function Field({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-primary mt-0.5">{value}</dd>
    </div>
  );
}

export function WorkflowContractHeader({ detail }: Props): React.JSX.Element {
  const { contract, progress } = detail;

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Selected Contract</h2>
        <Link href={`/contracts/${contract.id}`} className="text-xs text-accent hover:underline">
          Open Contract Detail
        </Link>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Field label="Contract ID" value={<span className="font-mono">{contract.referenceNumber}</span>} />
        <Field label="Contract Name" value={contract.title} />
        <Field label="Company / Client" value={contract.counterpartyName} />
        <Field label="Scope of Work" value={formatScopeSummary(contract.scopeOfWork)} />
        <Field label="Current Status" value={CONTRACT_STATUS_LABELS[contract.status] ?? contract.status} />
        <Field label="Workflow Progress" value={<WorkflowStatusBadge status={progress.workflowStatus} />} />
      </dl>
      {progress.total > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
          <Field label="Total Tasks" value={progress.total} />
          <Field label="Completed" value={progress.completed} />
          <Field label="In Progress" value={progress.inProgress} />
          <Field label="Overdue" value={progress.overdue > 0 ? <span className="text-error">{progress.overdue}</span> : 0} />
        </dl>
      )}
    </section>
  );
}
