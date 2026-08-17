import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';

export const metadata: Metadata = { title: 'Variations — Contract Management — RECAFCO FMP' };

interface PageProps {
  params: Promise<{ id: string }>;
}

const VARIATION_COLUMNS = ['Variation No.', 'Description', 'Amount', 'Status', 'Submitted Date', 'Approved Date', 'Remarks', 'Action'];

export default async function ContractVariationsTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const contract = await contractsApi.get(id).catch(() => null);
  if (!contract) notFound();

  const currentContractValue = contract.contractValue
    ? (contract.currency ? `${contract.contractValue} ${contract.currency}` : contract.contractValue)
    : 'Not started';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Variations</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track contract variation orders and their approval status.</p>
      </div>

      {/* Variation Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Variation Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-muted">Total Variations</dt>
            <dd className="font-medium text-text-primary mt-0.5">Not started</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Approved Variations</dt>
            <dd className="font-medium text-text-primary mt-0.5">Not started</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Pending Variations</dt>
            <dd className="font-medium text-text-primary mt-0.5">Not started</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Rejected / Cancelled</dt>
            <dd className="font-medium text-text-primary mt-0.5">Not started</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Current Contract Value</dt>
            <dd className="font-medium text-text-primary mt-0.5">{currentContractValue}</dd>
          </div>
        </dl>
      </section>

      <p className="text-xs text-text-muted">
        Variations may affect contract value and completion date. Tracking will be enabled after the Variations backend unit.
      </p>

      {/* Variations table */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Variations</h2>
          <button
            type="button"
            disabled
            title="Variations backend is not implemented yet."
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Plus className="size-3.5 shrink-0" aria-hidden="true" />
            Add Variation
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {VARIATION_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td colSpan={VARIATION_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                  No variation records tracked yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
