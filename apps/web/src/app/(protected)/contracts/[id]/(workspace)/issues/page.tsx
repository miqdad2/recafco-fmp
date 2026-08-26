import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { IssueRegisterTable } from '../../../issues/_components/issue-register-table';

export const metadata: Metadata = { title: 'Issue Log — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractIssuesTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, issuesRes, people] = await Promise.all([
    getUserPermissions(),
    contractsApi.listIssues({ contractId: id, pageSize: 100 }).catch(() => null),
    contractsApi.people().catch(() => []),
  ]);
  if (!issuesRes) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const { items: issues, summary } = issuesRes;

  const statusRows: { label: string; value: number }[] = [
    { label: 'Total Issues', value: summary.totalIssues },
    { label: 'Open Issues', value: summary.openIssues },
    { label: 'In Progress', value: summary.inProgressIssues },
    { label: 'Overdue Issues', value: summary.overdueIssues },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Issue Log</h1>
          <p className="text-xs text-text-secondary mt-0.5">Track contract issues, actions and resolutions.</p>
        </div>
        <Link
          href={`/contracts/issues?contractId=${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Open in Issue Register
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      {/* Issue Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Issue Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {statusRows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-text-muted">{row.label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Issue Log */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Issue Log</h2>
        <IssueRegisterTable issues={issues} contracts={[]} people={people} canUpdate={canUpdate} fixedContractId={id} />
      </section>
    </div>
  );
}
