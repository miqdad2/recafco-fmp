import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * FMP-TECH-01C — this was the FMP-UI-07 Executive Module Landing Page for
 * Technical: a placeholder-shaped page (static KPI grid off the platform
 * dashboard endpoint, "Not available yet" Needs Attention/Recent Activity
 * panels, one generic "View Technical Workflow" button into the OLD
 * ContractWorkflowTask board) — exactly the "too simple, placeholder-like"
 * page this unit's own root-cause investigation points at. FMP-TECH-01 had
 * already repointed every nav link (sidebar, Platform Dashboard card,
 * executive-modules.ts) to the real Technical module at `/technical`, but
 * this route itself was left rendering the old page for anyone who still
 * had it bookmarked or typed it directly — exactly the "route confusion"
 * this unit's ticket flags. Per that ticket's own preferred option (A):
 * redirect here instead of maintaining two different Technical dashboards.
 * Nothing else about `/contracts/*` is touched.
 */
export default function ContractsTechnicalRedirect(): never {
  redirect('/technical');
}
