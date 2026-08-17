import type { Metadata } from 'next';
import { ContractActivityTable } from '../../../_components/contract-activity-table';
import { contractsApi } from '../../../../../../lib/contracts-api';

export const metadata: Metadata = { title: 'Activity / Audit History — Contract Management — RECAFCO FMP' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractActivityTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const activities = await contractsApi.listActivities(id).catch(() => []);

  const now = new Date();
  const updatesThisMonth = activities.filter((a) => {
    const d = new Date(a.createdAt);
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
  }).length;
  const statusChanges = activities.filter((a) => a.previousStatus && a.newStatus).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Activity / Audit History</h1>
        <p className="text-xs text-text-secondary mt-0.5">View contract updates and status changes.</p>
      </div>

      {/* Activity Summary */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Activity Summary</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-muted">Total Activities</dt>
            <dd className="font-medium text-text-primary mt-0.5">{activities.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Updates This Month</dt>
            <dd className="font-medium text-text-primary mt-0.5">{updatesThisMonth}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Status Changes</dt>
            <dd className="font-medium text-text-primary mt-0.5">{statusChanges}</dd>
          </div>
        </dl>
      </section>

      {/* Search/filter row + Activity / Audit History table */}
      <ContractActivityTable activities={activities} />
    </div>
  );
}
