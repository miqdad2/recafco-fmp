import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, LayoutGrid } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { isExecutiveManagerOrAdminAccess } from '../../_lib/module-visibility';
import { ExecutiveModuleNav } from '../../_components/executive-module-nav';
import { ExecutiveModuleTitle } from '../../_components/executive-module-title';
import { ExecutiveComingSoon } from '../../_components/executive-coming-soon';

export const metadata: Metadata = { title: 'Quality Assurance & Control — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

/**
 * FMP-UI-10 — Executive Module Landing Page for QA/QC. No real backend
 * module exists yet, so there is nothing real to fetch — this page is
 * deliberately just the standard nav + title + an honest "coming later"
 * message, never a fake table or fabricated metric. Gated on
 * isExecutiveManagerOrAdminAccess (no dedicated permission exists yet —
 * see that function's own doc comment) rather than a per-module read
 * permission, matching PlatformDashboardService's identical gate on the
 * dashboard card itself.
 *
 * FMP-UI-10C — renamed "QA/QC" → "Quality Assurance & Control" everywhere
 * user-facing on this page; the route (/executive/qaqc), file path, and
 * `code="QA_QC"` are unchanged (technical slugs, per this unit's own
 * instruction).
 */
export default async function QaQcExecutivePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';

  const meResult = await authApi.me(accessToken);
  const permissions: string[] = meResult.ok ? meResult.data.permissions : [];
  if (!isExecutiveManagerOrAdminAccess(permissions)) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-6 lg:px-6">
      <ExecutiveModuleNav code="QA_QC" permissions={permissions} />

      <ExecutiveModuleTitle
        title="Quality Assurance & Control"
        description="Quality checks, inspections, approvals, and non-conformance follow-up."
        icon={BadgeCheck}
        accent="qaqc"
      />

      <ExecutiveComingSoon message="Quality Assurance & Control module will be configured in a future unit." />

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
