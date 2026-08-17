import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Printer } from 'lucide-react';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { DashboardScopeBadge } from '../../../_components/dashboard-scope-badge';
import { ContractLifecycleBadge } from '../../_components/contract-lifecycle-badge';
import { ContractDepartmentBadge } from '../../_components/contract-department-badge';
import { ContractWorkspaceTabs } from '../../_components/contract-workspace-tabs';
import { contractsApi } from '../../../../../lib/contracts-api';
import { getUserPermissions } from '../../_lib/get-user-permissions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface LayoutProps {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export default async function ContractWorkspaceLayout({ params, children }: LayoutProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissionsRes, contractRes, dashboardRes] = await Promise.allSettled([
    getUserPermissions(),
    contractsApi.get(id),
    contractsApi.dashboard(),
  ]);

  if (contractRes.status === 'rejected') notFound();

  const contract = (contractRes as PromiseFulfilledResult<Awaited<ReturnType<typeof contractsApi.get>>>).value;
  const viewerScope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;

  const permissions = permissionsRes.status === 'fulfilled' ? permissionsRes.value : [];
  const canEdit = contract.status === 'DRAFT' && permissions.includes('contracts.update');

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1800px] mx-auto space-y-4">
      <Breadcrumbs items={[
        { label: 'Contract Management', href: '/contracts/dashboard' },
        { label: 'Contract List', href: '/contracts' },
        { label: 'Contract Detail' },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-text-primary">
              {contract.referenceNumber} — {contract.title}
            </h1>
            <ContractLifecycleBadge status={contract.lifecycleStatus} />
            <ContractDepartmentBadge department={contract.department} />
            <DashboardScopeBadge scope={viewerScope} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span className="font-mono text-text-muted">{contract.referenceNumber}</span>
            <span>Client / Employer: {contract.counterpartyName}</span>
            <span>Contract Manager: {contract.ownerUser.displayName}</span>
            <span>Created: {formatDate(contract.createdAt)}</span>
            <span>Updated: {formatDate(contract.updatedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled
            title="Print / Export is planned for a future unit"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            <Printer className="size-3.5 shrink-0" aria-hidden="true" />
            Print / Export
          </button>
          <button
            type="button"
            disabled
            title="Additional actions are planned for a future unit"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-muted cursor-not-allowed"
          >
            Actions
            <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
          </button>
          {canEdit && (
            <Link
              href={`/contracts/${contract.id}/edit`}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Edit Contract
            </Link>
          )}
        </div>
      </div>

      <ContractWorkspaceTabs contractId={contract.id} />

      {children}
    </div>
  );
}
