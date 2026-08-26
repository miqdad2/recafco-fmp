import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ClaimRegisterTable } from '../../../claims/_components/claim-register-table';
import { formatContractValue } from '../../../_lib/contract-ui-helpers';

export const metadata: Metadata = { title: 'Claims Registry — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractClaimsTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, claimsRes, people] = await Promise.all([
    getUserPermissions(),
    contractsApi.listClaims({ contractId: id, pageSize: 100 }).catch(() => null),
    contractsApi.people().catch(() => []),
  ]);
  if (!claimsRes) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const { items: claims, summary } = claimsRes;

  const statusRows: { label: string; value: string }[] = [
    { label: 'Open Claims', value: String(summary.openClaims) },
    { label: 'Submitted Value', value: formatContractValue(summary.totalSubmittedValue, 'KWD') },
    { label: 'Approved Value', value: formatContractValue(summary.totalApprovedValue, 'KWD') },
    { label: 'Outstanding Value', value: formatContractValue(summary.totalOutstandingValue, 'KWD') },
    { label: 'Overdue Claims', value: String(summary.overdueClaims) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Claims Registry</h1>
          <p className="text-xs text-text-secondary mt-0.5">Track contract claims, values and next actions.</p>
        </div>
        <Link
          href={`/contracts/claims?contractId=${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Open in Claim Register
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      {/* Claim Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Claim Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          {statusRows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-text-muted">{row.label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Claims Registry */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Claims Registry</h2>
        <ClaimRegisterTable claims={claims} contracts={[]} people={people} canUpdate={canUpdate} fixedContractId={id} />
      </section>
    </div>
  );
}
