import { Sparkles } from 'lucide-react';
import type { ManagerDashboardSummary } from '@/lib/contracts-api';
import { buildTodaysFocusSegments } from '../../_lib/contract-dashboard-focus';

interface Props {
  summary: ManagerDashboardSummary | undefined;
}

/**
 * CM-39C — compact highlighted strip that turns the same real summary counts
 * already shown on the KPI cards into one plain-language "what needs
 * attention right now" sentence, so a manager doesn't have to scan all 5
 * cards to know where to start.
 */
export function TodaysFocusPanel({ summary }: Props): React.JSX.Element {
  const segments = buildTodaysFocusSegments(summary);

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
      <Sparkles className="size-4 shrink-0 text-accent mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">Today&apos;s Focus</p>
        <p className="text-sm text-text-secondary mt-0.5">
          {segments.length > 0 ? segments.join(' · ') : 'All caught up — nothing urgent right now.'}
        </p>
      </div>
    </div>
  );
}
