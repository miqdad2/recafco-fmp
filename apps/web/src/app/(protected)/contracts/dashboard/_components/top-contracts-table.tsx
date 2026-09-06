import Link from 'next/link';

export interface TopContractsTableRow {
  contractId: string;
  jobOrderLabel: string;
  projectName: string;
  metricDisplay: string;
}

interface Props {
  title: string;
  metricColumnLabel: string;
  rows: TopContractsTableRow[];
  emptyMessage: string;
}

// CM-54 — reusable Top 5 table (Job Order / Project Name / metric column),
// used for both "Top 5 Delayed Contracts" (Delay (Days)) and "Top 5
// Contracts by Value" (Value (KWD)) per the column-rename change request.
// CM-54C — visual-only polish: shaded header row for stronger contrast,
// roomier rows, tabular-numeral metric column. Same columns/rows/values.
// CM-54D — row spacing tightened a notch to match the panel it now sits
// beside. Same columns/rows/values.
export function TopContractsTable({ title, metricColumnLabel, rows, emptyMessage }: Props): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-text-muted">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-80 text-xs">
            <thead>
              <tr className="bg-surface-secondary text-left text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="py-1.5 pl-1 pr-2 font-semibold rounded-l-md">Job Order</th>
                <th className="py-1.5 pr-2 font-semibold">Project Name</th>
                <th className="py-1.5 pr-1 font-semibold text-right rounded-r-md">{metricColumnLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.contractId} className="hover:bg-surface-hover transition-colors">
                  <td className="py-2 pl-1 pr-2 whitespace-nowrap">
                    <Link href={`/contracts/${row.contractId}`} className="font-semibold text-accent hover:underline">
                      {row.jobOrderLabel}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 max-w-45 truncate text-text-secondary" title={row.projectName}>{row.projectName}</td>
                  <td className="py-2 pr-1 text-right font-semibold text-text-primary tabular-nums whitespace-nowrap">{row.metricDisplay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
