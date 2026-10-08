import Link from 'next/link';
import { Target, CheckCircle2, ArrowUpRight } from 'lucide-react';
import type { TechnicalDashboardData } from '@/lib/technical-api';
import { TECHNICAL_STAGE_LABELS } from '@/lib/technical-api';
import { stageHref, STAGE_ACTION_LABELS } from '../_lib/technical-format';
import { buildNextActionItems, RELEASE_MESSAGES } from '../_lib/technical-dashboard-selector-helpers';

interface Props {
  dashboard: TechnicalDashboardData;
}

/**
 * Next Action Focus — at most 5 rows. FMP-BOQ-16: Technical release work comes
 * first (confirmed pieces not generated, pieces not assigned to groups, groups
 * with no files, submitted groups waiting approval, approved groups waiting
 * release); the existing workflow actions (FMP-UI-31) follow. Read-only: every
 * row is just an "Open" link.
 */
export function NextActionPanel({ dashboard }: Props): React.JSX.Element {
  const items = buildNextActionItems(dashboard.jobs, dashboard.releaseByContract ?? {}, dashboard.needsAttention);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center gap-2.5 rounded-lg border border-success/40 bg-success-light p-4 text-sm text-success">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        {RELEASE_MESSAGES.upToDate}
      </div>
    );
  }

  return (
    <div className="h-full rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        <Target className="size-3.5" aria-hidden="true" />
        Next Action Focus
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-secondary/50 px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{item.jobLabel}</p>
              <p className="truncate text-xs text-text-secondary">{item.project}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {item.stage ? `${STAGE_ACTION_LABELS[item.stage]} · ${TECHNICAL_STAGE_LABELS[item.stage]}` : item.text}
              </p>
            </div>
            <Link
              href={item.stage ? stageHref(item.contractId, item.stage) : `/technical/jobs/${item.contractId}`}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline"
            >
              Open
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
