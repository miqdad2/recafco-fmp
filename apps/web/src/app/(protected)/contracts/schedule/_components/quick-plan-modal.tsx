'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, X } from 'lucide-react';
import type { ContractScheduleOverviewRow } from '@/lib/contracts-api';
import { updateContractSchedulePlanAction } from '../../actions';
import { inputCls, labelCls } from '../../_components/contract-form-fields';
import { TEAM_OTHER, showsProductionDetails } from '../../_lib/contract-schedule-plan-form';
import {
  FRIDAY_CONFIRM,
  FRIDAY_WARNING,
  hasFridayDate,
  QUICK_PLAN_STAGES,
  QUICK_PLAN_TEAMS,
  contractOptions,
  findExistingPlannedStage,
  hasQuickPlanErrors,
  quickPlanPayload,
  validateQuickPlan,
  type QuickPlanErrors,
  type QuickPlanForm,
} from '../_lib/quick-plan';
import { formatScheduleOverviewDate } from '../_lib/global-schedule-helpers';

interface Props {
  rows: ContractScheduleOverviewRow[];
  initial: QuickPlanForm;
  /** 'edit' = opened from an existing milestone: contract and stage are fixed and no overwrite prompt is needed. */
  mode: 'create' | 'edit';
  onClose: () => void;
  onSaved: () => void;
}

function FieldError({ message }: { message: string | undefined }): React.JSX.Element | null {
  return message ? <p role="alert" className="mt-1 text-xs text-error">{message}</p> : null;
}

/**
 * FMP-PLANNING-05 — Quick Plan Activity. Saves ONE stage into the contract's
 * existing planned schedule through the same server action the Contract
 * Detail > Schedule modal uses (PATCH :id/schedule/planned — contracts.update
 * and department scope are enforced server-side). Contract Detail > Schedule
 * stays the source of truth; actual dates are not part of this form.
 */
export function QuickPlanModal({ rows, initial, mode, onClose, onSaved }: Props): React.JSX.Element {
  const [form, setForm] = useState<QuickPlanForm>(initial);
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<QuickPlanErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'overwrite' | 'friday' | null>(null);
  // Which confirmations the user has already accepted for the current form values.
  const [accepted, setAccepted] = useState({ overwrite: false, friday: false });
  const [isPending, startTransition] = useTransition();

  const options = useMemo(() => contractOptions(rows, query), [rows, query]);
  const existing = form.contractId && form.stageKey ? findExistingPlannedStage(rows, form.contractId, form.stageKey) : undefined;
  const isEdit = mode === 'edit';

  function patch(p: Partial<QuickPlanForm>): void {
    setForm((f) => ({ ...f, ...p }));
    setConfirm(null);
    setAccepted({ overwrite: false, friday: false });
  }

  const friday = hasFridayDate(form);

  /** Validation first; then the overwrite prompt, then the Friday prompt; only then the save. */
  function save(accept?: 'overwrite' | 'friday'): void {
    setServerError(null);
    const found = validateQuickPlan(form);
    setErrors(found);
    if (hasQuickPlanErrors(found)) return;
    const ok = { ...accepted, ...(accept ? { [accept]: true } : {}) };
    setAccepted(ok);
    if (!isEdit && existing && !ok.overwrite) {
      setConfirm('overwrite');
      return;
    }
    if (friday && !ok.friday) {
      setConfirm('friday');
      return;
    }
    setConfirm(null);
    startTransition(async () => {
      const result = await updateContractSchedulePlanAction(form.contractId, quickPlanPayload(form));
      if (result.error) {
        setServerError(result.error);
        setConfirm(null);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Plan' : 'Plan Activity'}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{isEdit ? 'Edit Plan' : 'Plan Activity'}</h2>
            <p className="mt-0.5 text-xs text-text-muted">Saved into the contract’s planned schedule. Actual dates update automatically from system activity.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {friday && (
            <div role="status" data-testid="friday-warning" className="rounded-md border border-warning bg-warning-light px-4 py-2.5 text-sm text-text-primary">
              {FRIDAY_WARNING}
            </div>
          )}

          {serverError && <div role="alert" className="rounded-md border border-error bg-error-light px-4 py-2.5 text-sm text-error">{serverError}</div>}

          <div>
            <label className={labelCls} htmlFor="qp-contract">Contract / Project</label>
            {isEdit ? (
              <p className="text-sm text-text-primary">{contractOptions(rows, '').find((o) => o.id === form.contractId)?.label ?? '—'}</p>
            ) : (
              <>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contract, project or client…" aria-label="Search contracts" className={`${inputCls} mb-1.5`} />
                <select id="qp-contract" value={form.contractId} onChange={(e) => patch({ contractId: e.target.value })} className={inputCls}>
                  <option value="">Select contract / project</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </>
            )}
            <FieldError message={errors.contractId} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="qp-stage">Activity / Stage</label>
              {isEdit ? (
                <p className="text-sm text-text-primary">{QUICK_PLAN_STAGES.find((s) => s.key === form.stageKey)?.label}</p>
              ) : (
                <select id="qp-stage" value={form.stageKey} onChange={(e) => patch({ stageKey: e.target.value as QuickPlanForm['stageKey'] })} className={inputCls}>
                  <option value="">Select activity / stage</option>
                  {QUICK_PLAN_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              )}
              <FieldError message={errors.stageKey} />
            </div>
            <div>
              <label className={labelCls} htmlFor="qp-team">Responsible Team</label>
              <select id="qp-team" value={form.team} onChange={(e) => patch({ team: e.target.value })} className={inputCls}>
                <option value="">Select team</option>
                {QUICK_PLAN_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <FieldError message={errors.team} />
            </div>
          </div>

          {form.team === TEAM_OTHER && (
            <div>
              <label className={labelCls} htmlFor="qp-other">Other Team Name</label>
              <input id="qp-other" value={form.otherName} onChange={(e) => patch({ otherName: e.target.value })} maxLength={100} className={inputCls} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="qp-start">Planned Start</label>
              <input id="qp-start" type="date" value={form.plannedStartDate} onChange={(e) => patch({ plannedStartDate: e.target.value })} className={inputCls} />
              <FieldError message={errors.plannedStartDate} />
            </div>
            <div>
              <label className={labelCls} htmlFor="qp-end">Planned End <span className="font-normal text-text-muted">(optional)</span></label>
              <input id="qp-end" type="date" value={form.plannedEndDate} onChange={(e) => patch({ plannedEndDate: e.target.value })} className={inputCls} />
              <FieldError message={errors.plannedEndDate} />
            </div>
          </div>

          {form.stageKey && showsProductionDetails(form.stageKey) && (
            <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-surface-secondary/50 p-3 sm:grid-cols-2" data-testid="production-details">
              <div>
                <label className={labelCls} htmlFor="qp-qty">Planned Qty</label>
                <input id="qp-qty" inputMode="decimal" value={form.plannedQuantity} onChange={(e) => patch({ plannedQuantity: e.target.value })} className={inputCls} />
                <FieldError message={errors.plannedQuantity} />
              </div>
              <div>
                <label className={labelCls} htmlFor="qp-molds">Planned Molds</label>
                <input id="qp-molds" inputMode="numeric" value={form.plannedMolds} onChange={(e) => patch({ plannedMolds: e.target.value })} className={inputCls} />
                <FieldError message={errors.plannedMolds} />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="qp-remarks">Remarks <span className="font-normal text-text-muted">(optional)</span></label>
            <textarea id="qp-remarks" rows={2} maxLength={2000} value={form.remarks} onChange={(e) => patch({ remarks: e.target.value })} className={inputCls} />
          </div>

          {confirm === 'overwrite' && existing && (
            <div role="alertdialog" aria-label="Confirm update" className="rounded-md border border-warning bg-warning-light px-4 py-3 text-sm text-text-primary">
              <p className="font-medium">This activity already has a planned date. Do you want to update it?</p>
              <p className="mt-1 text-xs text-text-secondary">
                Current plan: {formatScheduleOverviewDate(existing.plannedStartDate)}
                {existing.plannedEndDate ? ` → ${formatScheduleOverviewDate(existing.plannedEndDate)}` : ''}. Other stages are not changed.
              </p>
            </div>
          )}

          {confirm === 'friday' && (
            <div role="alertdialog" aria-label="Confirm Friday" className="rounded-md border border-warning bg-warning-light px-4 py-3 text-sm text-text-primary">
              <p className="font-medium">{FRIDAY_CONFIRM}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={confirm ? () => setConfirm(null) : onClose}
            disabled={isPending}
            className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save(confirm ?? undefined)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {confirm === 'overwrite' ? 'Update Activity' : confirm === 'friday' ? 'Plan Anyway' : isEdit ? 'Save Plan' : 'Plan Activity'}
          </button>
        </div>
      </div>
    </div>
  );
}
