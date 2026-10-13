import Link from 'next/link';
import { CheckCircle2, Lock } from 'lucide-react';
import type { GuidedWorkflowModel } from '../_lib/technical-guided-workflow';
import { stepBadge, technicalStepHref, VIEW_ONLY_MESSAGE } from '../_lib/technical-step-ui';
import { BADGE, BTN_PRIMARY, BTN_SECONDARY } from '../_lib/button-styles';

// ---------------------------------------------------------------------------
// FMP-TECH-23 — Technical Details as an overview: the current step with one
// Continue button, and five step cards. Each card opens that step's own page
// (View when done, Continue when current); a step that is not ready only
// explains what must be finished first. No update controls live here.
// ---------------------------------------------------------------------------

interface Props {
  contractId: string;
  guided: GuidedWorkflowModel;
  canWrite: boolean;
}

export function TechnicalStepOverview({ contractId, guided, canWrite }: Props): React.JSX.Element {
  const current = guided.steps.find((s) => s.key === guided.currentKey);
  // Everything done: point at the last step for review. Nothing current and not complete (data not loaded): start from Confirm Elements.
  const continueKey = current?.key ?? (guided.complete ? 'release-to-production' : 'confirm-elements');
  const continueLabel = guided.steps.find((s) => s.key === continueKey)?.label ?? '';

  return (
    <div className="space-y-4">
      <section aria-label="Current Technical Step" className={`rounded-lg border p-4 ${guided.complete ? 'border-success bg-success-light' : 'border-accent bg-accent-light/40'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {guided.complete ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              {guided.nextAction}
            </p>
          ) : (
            <dl className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current Technical Step</dt>
                <dd className="mt-0.5 text-lg font-bold text-text-primary">{continueLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Next Action</dt>
                <dd className="mt-0.5 text-sm text-text-primary">{guided.nextAction}</dd>
              </div>
            </dl>
          )}
          <Link
            href={technicalStepHref(contractId, continueKey)}
            className={`${BTN_PRIMARY} !h-10 !px-5`}
          >
            {guided.complete ? `View: ${continueLabel}` : `Continue: ${continueLabel}`}
          </Link>
        </div>
        {!canWrite && <p className="mt-3 text-xs text-text-secondary">{VIEW_ONLY_MESSAGE}</p>}
      </section>

      <ol aria-label="Technical work steps" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {guided.steps.map((step, i) => {
          const badge = stepBadge(step);
          const locked = step.state === 'locked';
          const action = step.state === 'done' ? 'View' : step.state === 'current' ? 'Continue' : 'Open';
          return (
            <li key={step.key} className={`flex flex-col gap-2 rounded-lg border bg-surface p-4 ${step.state === 'current' ? 'border-accent ring-1 ring-accent/30' : 'border-border'} ${locked ? 'bg-surface-secondary/40' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.state === 'done' ? 'bg-success-light text-success' : locked ? 'bg-surface-secondary text-text-muted' : 'bg-accent-light text-accent'}`}>
                  {step.state === 'done' ? <CheckCircle2 className="size-4" aria-hidden="true" /> : locked ? <Lock className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className={`${BADGE} ${badge.classes}`}>{badge.label}</span>
              </div>
              <h3 className={`text-sm font-semibold ${locked ? 'text-text-muted' : 'text-text-primary'}`}>{step.label}</h3>
              <p className="flex-1 text-xs text-text-secondary">{locked ? step.lockedMessage : step.summary}</p>
              {!locked && (
                <Link
                  href={technicalStepHref(contractId, step.key)}
                  className={step.state === 'current' ? `${BTN_PRIMARY} !h-8 !px-3 !text-xs` : BTN_SECONDARY}
                >
                  {action}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

