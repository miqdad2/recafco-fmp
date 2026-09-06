import Link from 'next/link';
import { ClipboardList, CreditCard, FileWarning, MessageSquareWarning, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ManagerDashboardSummary, ManagerDashboardInsights } from '@/lib/contracts-api';

interface Props {
  summary: ManagerDashboardSummary | undefined;
  insights: ManagerDashboardInsights | undefined;
}

interface Row {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
  count: number;
  href: string;
}

// CM-54 — "Management Attention Required". Expiring Documents removed (no
// document-expiry tracking exists in this schema); the former "High/Critical
// Risks" row is now "Critical Project Contracts" per the wording change
// request. Every count/description here is real data already computed by
// contract-dashboard.service.ts (summary/insights) — no invented numbers.
// CM-54B — "Overdue Payments" renamed to "Overdue Payment Follow-ups" (plain
// payment-flow wording, same insights.financials.overduePayments count/href,
// no calculation change).
// CM-54C — visual-only polish: roomier rows, a stronger count badge, and
// clearer header spacing. Same rows/counts/hrefs, no calculation change.
// CM-54D — row spacing tightened a notch for a more compact, executive
// feel. Same rows/counts/hrefs, no calculation change.
export function ManagementAttentionRequiredPanel({ summary, insights }: Props): React.JSX.Element {
  if (!summary || !insights) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Management Attention Required</h2>
        <p className="text-xs text-text-muted">Data unavailable.</p>
      </section>
    );
  }

  const rows: Row[] = [
    {
      key: 'overdue-tasks', icon: ClipboardList, label: 'Overdue Workflow Tasks',
      description: `${summary.overdueWorkflowTasks} task${summary.overdueWorkflowTasks === 1 ? '' : 's'} overdue across ${insights.overdueWorkflowTasksContracts} contract${insights.overdueWorkflowTasksContracts === 1 ? '' : 's'}`,
      count: summary.overdueWorkflowTasks, href: '/contracts/workflow?overdueOnly=true',
    },
    {
      key: 'overdue-payments', icon: CreditCard, label: 'Overdue Payment Follow-ups',
      description: 'Payments pending follow-up or release',
      count: insights.financials.overduePayments, href: '/contracts/payments?overdueOnly=true',
    },
    {
      key: 'critical-contracts', icon: FileWarning, label: 'Critical Project Contracts',
      description: `${insights.criticalProjectContracts} contract${insights.criticalProjectContracts === 1 ? '' : 's'} require immediate attention`,
      count: insights.criticalProjectContracts, href: '/contracts',
    },
    {
      key: 'open-issues', icon: MessageSquareWarning, label: 'Open Issues',
      description: `${summary.openIssues} issue${summary.openIssues === 1 ? '' : 's'} open`,
      count: summary.openIssues, href: '/contracts/issues',
    },
    {
      key: 'claims-action-due', icon: Clock, label: 'Claims with Action Due',
      description: `${insights.claimsWithActionDue} claim${insights.claimsWithActionDue === 1 ? '' : 's'} have action pending beyond due date`,
      count: insights.claimsWithActionDue, href: '/contracts/claims',
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Management Attention Required</h2>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key}>
            <Link href={row.href} className="flex items-center gap-3 py-2.5 group focus:outline-none focus:ring-2 focus:ring-focus rounded-md -mx-1.5 px-1.5 transition-colors hover:bg-surface-hover">
              <span className="inline-flex items-center justify-center size-8 rounded-full bg-surface-secondary text-text-secondary shrink-0">
                <row.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-text-primary group-hover:underline">{row.label}</span>
                <span className="block text-[11px] text-text-muted truncate mt-0.5">{row.description}</span>
              </span>
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-full bg-error-light text-error text-xs font-bold tabular-nums shrink-0">
                {row.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
