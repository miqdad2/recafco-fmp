import type { Contract } from '@/lib/contracts-api';

interface Props {
  contract: Contract;
}

function TextField({ label, value }: { label: string; value: string | undefined }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary mt-0.5 whitespace-pre-wrap">{value || '—'}</dd>
    </div>
  );
}

export function ContractScopeDetailsCard({ contract }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">Scope &amp; Schedule Details</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
        <TextField label="Scope Description" value={contract.scopeDescription} />
        <TextField label="Scope Exclusions" value={contract.scopeExclusions} />
        <TextField label="Deliverables" value={contract.deliverables} />
        <TextField label="Milestones" value={contract.milestones} />
        <TextField label="Schedule" value={contract.scheduleSummary} />
        <TextField label="Quantities and Specifications" value={contract.quantitiesSpecifications} />
      </dl>
    </section>
  );
}
