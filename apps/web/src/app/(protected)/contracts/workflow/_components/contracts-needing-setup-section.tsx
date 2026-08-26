import Link from 'next/link';
import type { WorkflowContractNeedingSetup } from '@/lib/contracts-api';
import { formatScopeSummary } from '../../_lib/contract-ui-helpers';

interface Props {
  contracts: WorkflowContractNeedingSetup[];
}

/**
 * CM-40 — contracts whose saved scope calls for workflow tasks that haven't
 * been generated yet (a contract's board is only populated on first view —
 * see ContractWorkflowService.getWorkflowForContract). "Generate/View Board"
 * intentionally links to the existing board view rather than calling a new
 * bulk-generate endpoint: opening the board already lazily (and idempotently)
 * creates the missing tasks as a side effect of the manager's own explicit
 * click, never silently in the background.
 */
export function ContractsNeedingSetupSection({ contracts }: Props): React.JSX.Element | null {
  if (contracts.length === 0) return null;

  return (
    <section aria-labelledby="needs-setup-heading">
      <h2 id="needs-setup-heading" className="text-sm font-semibold text-text-primary mb-1">
        Contracts needing workflow setup
      </h2>
      <p className="text-xs text-text-muted mb-2">
        These active contracts have a saved scope of work but no workflow tasks generated yet.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[720px] divide-y divide-border text-xs">
          <thead className="border-b-2 border-border-strong">
            <tr className="bg-surface-secondary">
              {['Contract ID', 'Contract Name', 'Scope Summary', 'Action'].map((col) => (
                <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {contracts.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-1.5 whitespace-nowrap align-top">
                  <span className="font-mono text-text-primary">{c.referenceNumber}</span>
                </td>
                <td className="px-3 py-1.5 max-w-[240px] truncate align-top" title={c.title}>{c.title}</td>
                <td className="px-3 py-1.5 max-w-[320px] truncate align-top">{formatScopeSummary(c.scopeOfWork)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap align-top">
                  <Link href={`/contracts/workflow?contractId=${c.id}`} className="text-accent hover:underline font-medium">
                    Generate / View Board
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
