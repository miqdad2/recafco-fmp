'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SCHEDULE_STATUS_OPTIONS, SCHEDULE_STATUS_BADGE_CLASSES, scheduleStatusLabel } from '../_lib/contract-ui-helpers';
import { updateContractScheduleStatusAction } from '../actions';

interface Props {
  contractId: string;
  value: string;
  /** Only actors with contracts.update may change this — everyone else sees a plain read-only badge, per "never show an editable field that doesn't save". */
  canEdit: boolean;
}

/**
 * CM-55 — Contract List Status column. A colored badge-styled <select> that
 * PATCHes only Contract.scheduleStatus (never the lifecycle status) via
 * updateContractScheduleStatusAction. Read-only badge (no <select>, no
 * onChange) for any actor without contracts.update.
 */
export function ContractScheduleStatusSelect({ contractId, value, canEdit }: Props): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const badgeClass = SCHEDULE_STATUS_BADGE_CLASSES[current as keyof typeof SCHEDULE_STATUS_BADGE_CLASSES] ?? SCHEDULE_STATUS_BADGE_CLASSES.IN_PROGRESS;

  if (!canEdit) {
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
        {scheduleStatusLabel(current)}
      </span>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value;
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const result = await updateContractScheduleStatusAction(contractId, next);
      if (result.error) {
        setCurrent(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <select
        value={current}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Schedule status"
        className={`rounded-full pl-2.5 pr-6 py-0.5 text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60 ${badgeClass}`}
      >
        {SCHEDULE_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span className="text-[11px] text-error">{error}</span>}
    </div>
  );
}
