import { Check } from 'lucide-react';
import { ERECTION_WORKFLOW_STEPS } from '../../../../../../_lib/contract-erection-method-statement-helpers';

interface Props {
  /** The step number currently active on screen (1 for this unit — steps 2-7 have no screen yet). */
  currentStep: number;
}

/**
 * CM-71A — read-only/navigation-style 7-step Erection Workflow tracker.
 * Only Step 1 has a real screen in this unit; steps 2-7 are shown plainly as
 * pending (no click handler, no route) — this component is presentational
 * only and carries no workflow-progress data of its own. Reused as-is by
 * every future step's screen once built (CM-71B onward).
 */
export function ErectionWorkflowStepTracker({ currentStep }: Props): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {ERECTION_WORKFLOW_STEPS.map((s, i) => {
          const isDone = s.step < currentStep;
          const isCurrent = s.step === currentStep;
          return (
            <div key={s.step} className="flex items-center">
              <div className="flex flex-col items-center gap-1 w-24">
                <span
                  className={[
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isDone
                      ? 'border-success bg-success text-white'
                      : isCurrent
                        ? 'border-accent bg-accent text-white'
                        : 'border-border text-text-muted',
                  ].join(' ')}
                >
                  {isDone ? <Check className="size-3.5" aria-hidden="true" /> : s.step}
                </span>
                <span
                  className={`text-[10px] leading-tight text-center ${isCurrent ? 'font-semibold text-text-primary' : 'text-text-muted'}`}
                >
                  {s.label}
                </span>
              </div>
              {i < ERECTION_WORKFLOW_STEPS.length - 1 && (
                <span className="h-px w-6 sm:w-10 bg-border shrink-0 mb-4" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
