import Link from 'next/link';
import { Check } from 'lucide-react';
import { TECHNICAL_STAGE_ORDER, TECHNICAL_STAGE_LABELS } from '@/lib/technical-api';
import type { TechnicalStage, TechnicalWorkflowStatus } from '@/lib/technical-api';
import { computeStageMode, stageHref } from '../_lib/technical-format';

const MODE_TITLES: Record<'active' | 'completed' | 'locked', string> = {
  active: 'Current',
  completed: 'Completed',
  locked: 'Pending',
};

interface Props {
  contractId: string;
  currentStage: TechnicalStage;
  workflowStatus: TechnicalWorkflowStatus;
}

/**
 * FMP-TECH-05E — the one shared, clickable 4-step Technical workflow
 * stepper, used by all 4 stage pages and the workflow overview page. Every
 * step is a real `<Link>` to that stage's own page — this is an internal
 * RECAFCO system, so completed, current, AND future stages are all equally
 * clickable/viewable; only what each stage page lets you DO once you're
 * there depends on `computeStageMode()`, enforced ultimately by the
 * backend's own `assertXxxStageIsCurrent()` gates.
 *
 * FMP-TECH-05F — a future ("pending") step renders with the
 * exact same plain numbered-circle treatment as every other step, just in
 * the muted color — no lock icon, no "forbidden" styling. `MODE_TITLES`
 * gives each step an accessible `title`/labeled state (Completed / Current
 * / Pending) without adding visible text that would bloat this compact bar.
 */
export function TechnicalStepper({ contractId, currentStage, workflowStatus }: Props): React.JSX.Element {
  return (
    <ol className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-2.5 text-xs">
      {TECHNICAL_STAGE_ORDER.map((stage, i) => {
        const mode = computeStageMode(stage, currentStage, workflowStatus);
        const isActive = mode === 'active';
        return (
          <li key={stage} className="flex items-center gap-1">
            <Link
              href={stageHref(contractId, stage)}
              title={`${TECHNICAL_STAGE_LABELS[stage]} — ${MODE_TITLES[mode]}`}
              className={[
                'flex items-center gap-1.5 rounded-full py-1 transition-colors',
                isActive ? 'bg-accent-light pl-1 pr-2.5' : 'px-1 hover:bg-surface-secondary',
              ].join(' ')}
            >
              <span
                className={[
                  'flex shrink-0 items-center justify-center rounded-full font-semibold',
                  isActive ? 'size-6 text-[11px]' : 'size-5 text-[10px]',
                  mode === 'completed' ? 'bg-success text-white' : isActive ? 'bg-accent text-accent-foreground' : 'bg-surface-secondary text-text-muted',
                ].join(' ')}
              >
                {mode === 'completed' ? <Check className="size-3" aria-hidden="true" /> : i + 1}
              </span>
              <span className={isActive ? 'font-bold text-accent' : mode === 'completed' ? 'font-medium text-text-secondary' : 'text-text-muted'}>
                {TECHNICAL_STAGE_LABELS[stage]}
              </span>
            </Link>
            {i < TECHNICAL_STAGE_ORDER.length - 1 && <span className="mx-0.5 h-px w-4 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
