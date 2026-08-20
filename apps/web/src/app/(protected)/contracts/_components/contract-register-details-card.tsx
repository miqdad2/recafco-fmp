import type { Contract } from '@/lib/contracts-api';
import { formatContractValue } from '../_lib/contract-ui-helpers';

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

export function ContractRegisterDetailsCard({ contract }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">Register Details</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4">
        <Field label="Job Order" value={contract.jobOrder || '—'} />
        <Field label="Contract Date" value={formatDate(contract.contractDate)} />
        <Field label="Quotation #" value={contract.quotationNumber || '—'} />
        <Field label="Project Number" value={contract.projectNumber || '—'} />
        <Field label="Current Contract Value" value={formatContractValue(contract.contractValue, contract.currency)} />
        <Field label="Original Value" value={formatContractValue(contract.originalContractValue, contract.originalCurrency)} />
        <Field label="Forecast Completion Date" value={formatDate(contract.forecastCompletionDate)} />
        <Field label="Client Contact" value={contract.clientContactName || '—'} />
        <Field label="Client Telephone" value={contract.clientContactPhone || '—'} />
        <Field label="Project / Site Location" value={contract.projectSiteLocation || '—'} />
      </dl>
    </section>
  );
}
