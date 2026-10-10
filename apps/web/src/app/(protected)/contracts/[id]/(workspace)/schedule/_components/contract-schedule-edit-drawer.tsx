'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import type { ContractScheduleStageRow } from '@/lib/contracts-api';
import { updateContractSchedulePlanAction } from '../../../../actions';
import { inputCls } from '../../../../_components/contract-form-fields';
import { STAGE_KEY_LABELS } from '../../../../_lib/contract-schedule-detail-helpers';
import {
  PLAN_HELPER_TEXT,
  RESPONSIBLE_TEAM_OPTIONS,
  TEAM_OTHER,
  planDraftFromStage,
  planPayloadFromDrafts,
  showsProductionDetails,
  validatePlanDrafts,
  type PlanRowDraft,
  type PlanRowError,
} from '../../../../_lib/contract-schedule-plan-form';

interface Props {
  contractId: string;
  stages: ContractScheduleStageRow[];
  hasPlannedSchedule: boolean;
}

const GRID = 'md:grid md:grid-cols-[1.25fr_1.2fr_1fr_1fr_1.4fr] md:gap-3';
const CELL_LABEL = 'mb-1 block text-xs font-medium text-text-secondary md:sr-only';
const COMPACT = `${inputCls} py-1.5 text-sm`;

/**
 * CM-68A — Edit/Create Planned Schedule. A manager enters ONLY planned
 * fields for the fixed 8-stage list — no automatic dates are ever generated,
 * and this never touches actual/derived values (read-only everywhere on this
 * tab). FMP-CONTRACT-10: one compact row per stage (Stage, Responsible Team
 * dropdown, Planned Start/End, Remarks) instead of eight large cards;
 * Casting / Production alone gets a small "Production Details" strip for
 * Planned Qty / Planned Molds. Saves via updateContractSchedulePlanAction ->
 * PATCH :id/schedule/planned (contracts.update, enforced server-side) with
 * the same payload shape as before.
 */
export function ContractScheduleEditButton({ contractId, stages, hasPlannedSchedule }: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<PlanRowDraft[]>(() => stages.map(planDraftFromStage));
  const [errors, setErrors] = useState<PlanRowError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const title = hasPlannedSchedule ? 'Edit Planned Schedule' : 'Create Planned Schedule';

  function openModal(): void {
    setDrafts(stages.map(planDraftFromStage));
    setErrors([]);
    setServerError(null);
    setOpen(true);
  }

  function updateRow(stageKey: PlanRowDraft['stageKey'], patch: Partial<PlanRowDraft>): void {
    setDrafts((prev) => prev.map((d) => (d.stageKey === stageKey ? { ...d, ...patch } : d)));
  }

  function handleSave(): void {
    setServerError(null);
    const problems = validatePlanDrafts(drafts);
    setErrors(problems);
    if (problems.length > 0) return;

    startTransition(async () => {
      const result = await updateContractSchedulePlanAction(contractId, planPayloadFromDrafts(drafts));
      if (result.error) {
        setServerError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {title}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">{title}</h2>
                <p className="mt-0.5 text-xs text-text-muted">{PLAN_HELPER_TEXT}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* The one scroll area; header and footer stay put. */}
            <div className="overflow-y-auto px-5 py-3">
              {(errors.length > 0 || serverError) && (
                <div role="alert" className="mb-3 rounded-md border border-error bg-error-light px-4 py-2.5 text-sm text-error">
                  {errors.map((e) => <p key={`${e.stageKey}-${e.message}`}>{e.message}</p>)}
                  {serverError && <p>{serverError}</p>}
                </div>
              )}

              {/* Column headers (desktop) */}
              <div className={`${GRID} hidden border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted`}>
                <span>Stage</span>
                <span>Responsible Team</span>
                <span>Planned Start</span>
                <span>Planned End</span>
                <span>Remarks</span>
              </div>

              <div className="divide-y divide-border">
                {drafts.map((row) => {
                  const rowErrors = errors.filter((e) => e.stageKey === row.stageKey);
                  return (
                    <div key={row.stageKey} className="py-3" data-stage={row.stageKey}>
                      <div className={`${GRID} items-start space-y-2 md:space-y-0`}>
                        <p className="pt-1.5 text-sm font-semibold text-text-primary">{STAGE_KEY_LABELS[row.stageKey]}</p>

                        <div>
                          <label className={CELL_LABEL} htmlFor={`team-${row.stageKey}`}>Responsible Team</label>
                          <select
                            id={`team-${row.stageKey}`}
                            value={row.team}
                            onChange={(e) => updateRow(row.stageKey, { team: e.target.value })}
                            className={COMPACT}
                          >
                            <option value="">Select team</option>
                            {RESPONSIBLE_TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                            <option value={TEAM_OTHER}>{TEAM_OTHER}</option>
                          </select>
                          {row.team === TEAM_OTHER && (
                            <input
                              type="text"
                              value={row.otherName}
                              maxLength={100}
                              onChange={(e) => updateRow(row.stageKey, { otherName: e.target.value })}
                              placeholder="Other Team Name"
                              aria-label="Other Team Name"
                              className={`${COMPACT} mt-1.5`}
                            />
                          )}
                        </div>

                        <div>
                          <label className={CELL_LABEL} htmlFor={`start-${row.stageKey}`}>Planned Start</label>
                          <input
                            id={`start-${row.stageKey}`}
                            type="date"
                            value={row.plannedStartDate}
                            onChange={(e) => updateRow(row.stageKey, { plannedStartDate: e.target.value })}
                            className={COMPACT}
                          />
                        </div>

                        <div>
                          <label className={CELL_LABEL} htmlFor={`end-${row.stageKey}`}>Planned End</label>
                          <input
                            id={`end-${row.stageKey}`}
                            type="date"
                            value={row.plannedEndDate}
                            onChange={(e) => updateRow(row.stageKey, { plannedEndDate: e.target.value })}
                            className={`${COMPACT} ${rowErrors.some((e) => e.message.includes('Planned End')) ? 'border-error' : ''}`}
                          />
                        </div>

                        <div>
                          <label className={CELL_LABEL} htmlFor={`remarks-${row.stageKey}`}>Remarks</label>
                          <input
                            id={`remarks-${row.stageKey}`}
                            type="text"
                            value={row.remarks}
                            onChange={(e) => updateRow(row.stageKey, { remarks: e.target.value })}
                            className={COMPACT}
                          />
                        </div>
                      </div>

                      {showsProductionDetails(row.stageKey) && (
                        <div className="mt-2 rounded-md bg-surface-secondary px-3 py-2.5">
                          <p className="mb-2 text-xs font-semibold text-text-secondary">Production Details</p>
                          <div className="grid max-w-md grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="plan-qty">Planned Qty</label>
                              <input
                                id="plan-qty"
                                type="number"
                                min="0"
                                step="0.001"
                                value={row.plannedQuantity}
                                onChange={(e) => updateRow(row.stageKey, { plannedQuantity: e.target.value })}
                                className={COMPACT}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="plan-molds">Planned Molds</label>
                              <input
                                id="plan-molds"
                                type="number"
                                min="0"
                                step="1"
                                value={row.plannedMolds}
                                onChange={(e) => updateRow(row.stageKey, { plannedMolds: e.target.value })}
                                className={COMPACT}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-surface-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-60"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {isPending ? 'Saving…' : 'Save Planned Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
