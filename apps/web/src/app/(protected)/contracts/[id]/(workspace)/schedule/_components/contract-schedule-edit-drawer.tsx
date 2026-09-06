'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import type { ContractScheduleStageRow } from '@/lib/contracts-api';
import { updateContractSchedulePlanAction } from '../../../../actions';
import { inputCls, labelCls } from '../../../../_components/contract-form-fields';
import { STAGE_KEY_LABELS } from '../../../../_lib/contract-schedule-detail-helpers';

interface Props {
  contractId: string;
  stages: ContractScheduleStageRow[];
  hasPlannedSchedule: boolean;
}

interface RowDraft {
  stageKey: ContractScheduleStageRow['stageKey'];
  stageName: string;
  responsibleTeam: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedQuantity: string;
  plannedMolds: string;
  remarks: string;
}

function toDraft(stage: ContractScheduleStageRow): RowDraft {
  return {
    stageKey: stage.stageKey,
    stageName: stage.stageName || STAGE_KEY_LABELS[stage.stageKey],
    responsibleTeam: stage.responsibleTeam ?? '',
    plannedStartDate: stage.plannedStartDate ?? '',
    plannedEndDate: stage.plannedEndDate ?? '',
    plannedQuantity: stage.plannedQuantity !== null ? String(stage.plannedQuantity) : '',
    plannedMolds: stage.plannedMolds !== null ? String(stage.plannedMolds) : '',
    remarks: stage.remarks ?? '',
  };
}

/**
 * CM-68A — Edit/Create Planned Schedule. A manager enters ONLY planned
 * fields for the fixed 8-stage list — no automatic dates are ever
 * generated, and this never touches actual/derived values (those are
 * read-only everywhere on this tab). Planned Quantity/Molds inputs only
 * show for Casting / Production, matching the real ContractScheduleItem
 * model's own "mainly for Casting/Production" fields. Saves via
 * updateContractSchedulePlanAction -> PATCH :id/schedule/planned
 * (contracts.update permission, enforced server-side).
 */
export function ContractScheduleEditButton({ contractId, stages, hasPlannedSchedule }: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<RowDraft[]>(() => stages.map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openModal(): void {
    setDrafts(stages.map(toDraft));
    setError(null);
    setOpen(true);
  }

  function updateRow(stageKey: RowDraft['stageKey'], patch: Partial<RowDraft>): void {
    setDrafts((prev) => prev.map((d) => (d.stageKey === stageKey ? { ...d, ...patch } : d)));
  }

  function handleSave(): void {
    setError(null);
    const items = drafts.map((d) => ({
      stageKey: d.stageKey,
      stageName: d.stageName.trim() || undefined,
      responsibleTeam: d.responsibleTeam.trim() || undefined,
      plannedStartDate: d.plannedStartDate || undefined,
      plannedEndDate: d.plannedEndDate || undefined,
      plannedQuantity: d.plannedQuantity.trim() ? Number(d.plannedQuantity) : undefined,
      plannedMolds: d.plannedMolds.trim() ? Number(d.plannedMolds) : undefined,
      remarks: d.remarks.trim() || undefined,
    }));

    startTransition(async () => {
      const result = await updateContractSchedulePlanAction(contractId, items);
      if (result.error) {
        setError(result.error);
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
        {hasPlannedSchedule ? 'Edit Planned Schedule' : 'Create Planned Schedule'}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">{hasPlannedSchedule ? 'Edit Planned Schedule' : 'Create Planned Schedule'}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4">
              {error && <div className="rounded-md border border-danger bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>}
              <p className="text-xs text-text-muted">
                Enter the planned dates for each contract stage. Actual dates are read-only and will appear automatically when teams update workflow, payments, production, delivery/erection, and closeout.
              </p>

              {drafts.map((row) => (
                <div key={row.stageKey} className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-text-primary mb-2">{STAGE_KEY_LABELS[row.stageKey]}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={labelCls}>Responsible Team</label>
                      <input
                        type="text"
                        value={row.responsibleTeam}
                        onChange={(e) => updateRow(row.stageKey, { responsibleTeam: e.target.value })}
                        placeholder="e.g. Technical Team"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Planned Start</label>
                      <input
                        type="date"
                        value={row.plannedStartDate}
                        onChange={(e) => updateRow(row.stageKey, { plannedStartDate: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Planned End</label>
                      <input
                        type="date"
                        value={row.plannedEndDate}
                        onChange={(e) => updateRow(row.stageKey, { plannedEndDate: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    {row.stageKey === 'CASTING_PRODUCTION' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Planned Qty</label>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={row.plannedQuantity}
                            onChange={(e) => updateRow(row.stageKey, { plannedQuantity: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Planned Molds</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.plannedMolds}
                            onChange={(e) => updateRow(row.stageKey, { plannedMolds: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className={labelCls}>Remarks</label>
                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(e) => updateRow(row.stageKey, { remarks: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>
                  {row.stageKey === 'CASTING_PRODUCTION' && (
                    <div className="mt-2">
                      <label className={labelCls}>Remarks</label>
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => updateRow(row.stageKey, { remarks: e.target.value })}
                        className={`${inputCls} w-full`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
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
