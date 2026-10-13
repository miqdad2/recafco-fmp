import Link from 'next/link';
import { CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import type { GuidedStep } from '../_lib/technical-guided-workflow';
import type { WorkflowStepKey } from '../_lib/technical-workflow-helpers';
import { stepBadge, technicalStepHref } from '../_lib/technical-step-ui';

/**
 * FMP-TECH-23 — the small stepper at the top of every focused step page:
 * BOQ Drawings → Confirm Elements → … with this page's step highlighted.
 * Steps that are ready link to their page; steps that are not ready do not.
 */
export function WorkflowStepRow({ contractId, steps, active }: { contractId: string; steps: GuidedStep[]; active: WorkflowStepKey }): React.JSX.Element {
  return (
    <ol aria-label="Technical work steps" className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((step, i) => {
        const badge = stepBadge(step);
        const isActive = step.key === active;
        const locked = step.state === 'locked';
        const body = (
          <>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${step.state === 'done' ? 'bg-success-light text-success' : locked ? 'bg-surface-secondary text-text-muted' : 'bg-accent-light text-accent'}`}>
              {step.state === 'done' ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : locked ? <Lock className="size-3" aria-hidden="true" /> : i + 1}
            </span>
            <span className="text-xs font-semibold sm:text-sm">{step.label}</span>
            <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold md:inline ${badge.classes}`}>{badge.label}</span>
          </>
        );
        const cls = `inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${isActive ? 'border-accent bg-accent-light/50 text-text-primary' : locked ? 'border-border bg-surface-secondary/40 text-text-muted' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'}`;
        return (
          <li key={step.key} className="flex items-center gap-1">
            {locked ? (
              <span className={cls} title={step.lockedMessage ?? undefined}>{body}</span>
            ) : (
              <Link href={technicalStepHref(contractId, step.key)} aria-current={isActive ? 'step' : undefined} className={`${cls} focus:outline-none focus:ring-2 focus:ring-focus`}>
                {body}
              </Link>
            )}
            {i < steps.length - 1 && <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
