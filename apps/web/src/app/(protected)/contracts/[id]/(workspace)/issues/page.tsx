import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { ContractIssueKpiStrip } from './_components/contract-issue-kpi-strip';
import { ContractIssuePanel } from './_components/contract-issue-panel';

export const metadata: Metadata = { title: 'Issue Log — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-65 — Contract Detail Issue Log, approved-design build, simplified.
 * Issue Log tracks a problem that has ALREADY happened and needs follow-up
 * until resolved (final payment not received, document missing, delivery
 * delay, client approval pending, site access issue, quality/test report
 * pending, variation cost disagreement) — never confused with Risk
 * Assessment (future/potential risk). No Contract Summary card, no
 * "Issues by Category" donut chart, no "Recent Issue Activity" card, no
 * bottom KPI strip, no Back to Contract/Dashboard Overview buttons — the
 * user is already inside the contract workspace (the layout's own header
 * gives contract context), and none of the removed widgets are backed by
 * real reliable data anywhere in this app (no category-trend tracking, no
 * activity feed for issues specifically). Reuses the real
 * IssueFormModal/createIssueAction/updateIssueAction/closeIssueAction and
 * the module-level Issue Register's own CSV export (both from CM-30)
 * completely unmodified — this unit only builds a new display layer (KPI
 * strip, category/priority/status badges, column set, "Action Due Date"
 * wording) matching the approved design, same "contract-scoped page
 * reuses shared write actions, builds its own display layer" pattern
 * established for Payments/Claims/Risk/Documents & Obligations.
 */
export default async function ContractIssuesTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [permissions, issuesRes, people, contract] = await Promise.all([
    getUserPermissions(),
    contractsApi.listIssues({ contractId: id, pageSize: 200 }).catch(() => null),
    contractsApi.people().catch(() => []),
    // CM-70D — readable contract identity for the Add Issue modal (never
    // derivable from `issues` alone when the contract has no issues yet).
    contractsApi.get(id).catch(() => null),
  ]);
  if (!permissions.includes('contracts.read') || !issuesRes) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const { items: issues, summary } = issuesRes;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text-primary">Issue Log</h1>
        <p className="text-xs text-text-secondary mt-0.5">Track and manage contract issues, actions, and resolutions.</p>
      </div>

      <ContractIssueKpiStrip summary={summary} />

      <ContractIssuePanel
        contractId={id}
        issues={issues}
        people={people}
        canUpdate={canUpdate}
        {...(contract ? { contract: { referenceNumber: contract.referenceNumber, title: contract.title, counterpartyName: contract.counterpartyName } } : {})}
      />
    </div>
  );
}
