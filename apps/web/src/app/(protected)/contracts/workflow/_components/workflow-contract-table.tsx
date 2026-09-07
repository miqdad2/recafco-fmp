import Link from 'next/link';
import type { ContractWorkflowListItem } from '@/lib/contracts-api';
import { WorkflowStatusBadge } from './workflow-status-badge';

interface Props {
  items: ContractWorkflowListItem[];
  selectedContractId: string | undefined;
  buildHref: (overrides: Record<string, string | undefined>) => string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const COLUMNS = [
  'Contract ID', 'Project Name', 'Company / Client', 'Overall Progress',
  'Open Tasks', 'Overdue Tasks', 'Last Activity', 'Action',
];

export function WorkflowContractTable({ items, selectedContractId, buildHref }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No contracts match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[1200px] divide-y divide-border text-xs">
        <thead className="border-b-2 border-border-strong">
          <tr className="bg-surface-secondary">
            {COLUMNS.map((col) => (
              <th key={col} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {items.map((item) => {
            const isSelected = item.id === selectedContractId;
            return (
              <tr key={item.id} className={isSelected ? 'bg-accent/5' : undefined}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="font-mono text-accent">{item.referenceNumber}</span>
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate" title={item.title}>{item.title}</td>
                <td className="px-3 py-2 max-w-[160px] truncate" title={item.counterpartyName}>{item.counterpartyName}</td>
                <td className="px-3 py-2 whitespace-nowrap"><WorkflowStatusBadge status={item.workflowStatus} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-right">{item.openTasks}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  {item.overdueTasks > 0 ? (
                    <span className="text-error font-medium">{item.overdueTasks}</span>
                  ) : item.overdueTasks}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.lastUpdated)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    href={buildHref({ contractId: item.id })}
                    className="text-accent hover:underline font-medium"
                  >
                    View Board
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
