import type { Contract, ContractBoqItem } from '@/lib/contracts-api';
import { formatContractValue } from '../_lib/contract-ui-helpers';

interface Props {
  contract: Contract;
}

const MIX_DESIGN_LABELS: Record<string, string> = {
  GRAY: 'Gray',
  WHITE: 'White',
  NOT_APPLICABLE: 'Not Applicable',
};

function effectiveQty(item: ContractBoqItem): string {
  const qty = item.revisedQty ?? item.originalEstimatedQty;
  return qty ?? '—';
}

const COLUMNS = ['Item/Code', 'Category', 'Description', 'Qty', 'Unit', 'Mix Design', 'Concrete Grade', 'Unit Price', 'Total Price'];

export function ContractBoqItemsCard({ contract }: Props): React.JSX.Element {
  const items = contract.boqItems ?? [];

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-4">BOQ / Contract Items</h2>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No BOQ items registered.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-text-primary whitespace-nowrap">{item.itemCode || '—'}</td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{item.category || '—'}</td>
                  <td className="px-3 py-2 text-text-primary">{item.description}</td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{effectiveQty(item)}</td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{item.unitOfMeasure || '—'}</td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                    {item.mixDesignType ? (MIX_DESIGN_LABELS[item.mixDesignType] ?? item.mixDesignType) : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{item.concreteGrade || '—'}</td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{formatContractValue(item.unitPrice, contract.currency)}</td>
                  <td className="px-3 py-2 text-text-primary font-medium whitespace-nowrap">{formatContractValue(item.totalPrice, contract.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
