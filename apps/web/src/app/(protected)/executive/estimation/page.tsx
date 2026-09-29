import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator, LayoutGrid } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { isExecutiveManagerOrAdminAccess } from '../../_lib/module-visibility';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveComingSoon } from '../../_components/executive-coming-soon';

export const metadata: Metadata = { title: 'Estimation — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-23 — Executive Module Landing Page for the new Estimation module.
 * No real backend module exists yet, so there is nothing real to fetch —
 * this page is deliberately just the standard nav + title + an honest
 * "coming later" message, never a fake table or fabricated metric. Gated on
 * isExecutiveManagerOrAdminAccess (no dedicated permission exists — per
 * this unit's own explicit "do not create a new permission" instruction),
 * matching PlatformDashboardService's identical gate on the dashboard
 * card itself, and the same rule already used for QA/QC and Storage & Delivery.
 */
export default async function EstimationExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];
  if (!isExecutiveManagerOrAdminAccess(permissions)) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="ESTIMATION" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Estimation"
        description="Cost estimation, quotations, and pre-contract costing."
        icon={Calculator}
        accent="estimation"
      />

      <ExecutiveComingSoon message="Estimation will be configured in a future unit." />

      <div className="pt-2">
        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-6 text-base font-semibold text-accent-foreground transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          <LayoutGrid className="size-4" aria-hidden="true" />
          Back to Platform Dashboard
        </Link>
      </div>
    </div>
  );
}
