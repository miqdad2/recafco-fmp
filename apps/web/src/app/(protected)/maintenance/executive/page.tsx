import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { authApi } from '@/lib/auth-api';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { MaintenanceControlCenter } from '../_components/mms/maintenance-control-center';

export const metadata: Metadata = { title: 'Maintenance Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-07 — Executive Module Landing Page for Maintenance Management (the
 * route the Platform Dashboard card, executive sidebar, and module switcher
 * open).
 *
 * FMP-MAINT-03 — now renders the live MMS Maintenance Control Center (shared
 * with /maintenance/dashboard) instead of FMP-local maintenance request
 * counts, Quick Links, and the oversized "View Maintenance Requests" button.
 * FMP's own request log stays reachable from the control center's Quick
 * Actions, labelled as FMP local records. Same maintenance.read gate and
 * executive module navigation as before.
 */
export default async function MaintenanceExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken).catch(() => null);
  const permissions: string[] = meResult?.ok ? meResult.data.permissions : [];
  if (!permissions.includes('maintenance.read')) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-2.5 px-5 py-2.5 lg:px-6">
      <ExecutiveModuleNav code="MAINTENANCE_REQUESTS" permissions={permissions} />
      <MaintenanceControlCenter showBackLink={false} />
    </div>
  );
}
