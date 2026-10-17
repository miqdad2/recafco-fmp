import type { Metadata } from 'next';
import { MaintenanceControlCenter } from '../_components/mms/maintenance-control-center';

export const metadata: Metadata = { title: 'Maintenance Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

// FMP-MAINT-01/02/03 — department-sidebar entry point for the live MMS
// Maintenance Control Center (shared with /maintenance/executive). Access is
// enforced by the FMP API (maintenance.read + Maintenance module scope).
export default function MaintenanceDashboardPage(): React.JSX.Element {
  return (
    // FMP-UI-50 — widened from max-w-7xl to match /maintenance/executive's
    // own widening (same shared max-w-[1600px] cap, both pages render the
    // exact same `MaintenanceControlCenter`) — kept in sync so whichever
    // entry point a user lands on shows the same, wider layout.
    <div className="mx-auto max-w-[1600px] px-5 py-2.5 lg:px-6">
      <MaintenanceControlCenter />
    </div>
  );
}
