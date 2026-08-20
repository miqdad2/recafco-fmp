import type { Contract } from '@/lib/contracts-api';
import { CRANE_REQUIRED_OPTIONS, CRANE_PROVIDED_BY_OPTIONS, optionLabel } from '../_lib/contract-ui-helpers';

interface Props {
  contract: Contract;
}

function Field({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-primary mt-0.5">{value}</dd>
    </div>
  );
}

export function ContractCraneDetailsCard({ contract }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">Erection / Crane Information</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
        <Field label="Crane Required" value={optionLabel(CRANE_REQUIRED_OPTIONS, contract.craneRequired)} />
        <Field label="Crane Provided By" value={optionLabel(CRANE_PROVIDED_BY_OPTIONS, contract.craneProvidedBy)} />
        <Field label="Estimated Crane Capacity" value={contract.estimatedCraneCapacity || '—'} />
      </dl>
    </section>
  );
}
