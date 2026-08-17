import { ContractLifecycleBadge } from './contract-lifecycle-badge';
import type { Contract } from '@/lib/contracts-api';

interface Props {
  contract: Contract;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Field({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-primary mt-0.5">{value}</dd>
    </div>
  );
}

export function ContractInfoCard({ contract }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">Contract Information</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-4">
        <Field label="Contract ID" value={contract.referenceNumber} />
        <Field label="Contract Name" value={contract.title} />
        <Field label="Company / Client" value={contract.counterpartyName} />
        <Field label="Contract Manager" value={contract.ownerUser.displayName} />
        <Field label="Contract Status" value={<ContractLifecycleBadge status={contract.lifecycleStatus} />} />
        {contract.department && <Field label="Department" value={contract.department.name} />}
        {contract.startDate && <Field label="Start Date" value={formatDate(contract.startDate)} />}
        {contract.endDate && <Field label="End Date" value={formatDate(contract.endDate)} />}
        <Field label="Created Date" value={formatDate(contract.createdAt)} />
        <Field label="Last Updated" value={formatDate(contract.updatedAt)} />
      </dl>
    </section>
  );
}
