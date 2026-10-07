'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addProgressAction } from '../actions';

interface Props {
  taskId: string;
}

const FIELD = 'block w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/25';

/** Update progress: Complete (%) and Progress note. Same real action as before; refreshes the page on success. */
export function AddProgressForm({ taskId }: Props): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaved(false);
    setPending(true);
    void (async () => {
      const res = await addProgressAction(taskId, { error: null }, fd);
      const problem = res.error ?? res.fieldErrors?.['note']?.[0] ?? res.fieldErrors?.['progressPercent']?.[0] ?? null;
      setMessage(problem);
      if (!problem) {
        form.reset();
        setSaved(true);
        router.refresh();
      }
    })().finally(() => setPending(false));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message && <p role="alert" className="text-sm text-error">{message}</p>}
      {saved && <p role="status" className="text-sm text-success">Progress saved.</p>}

      <div className="max-w-[10rem]">
        <label htmlFor="progress-percent" className="mb-1 block text-sm font-medium text-text-primary">Complete (%)</label>
        <input id="progress-percent" name="progressPercent" type="number" min={0} max={100} step={1} placeholder="0-100" className={FIELD} />
        <p className="mt-1 text-sm text-text-muted">Enter a value from 0 to 100.</p>
      </div>

      <div>
        <label htmlFor="progress-note" className="mb-1 block text-sm font-medium text-text-primary">
          Progress note <span aria-hidden="true" className="text-error">*</span>
        </label>
        <textarea id="progress-note" name="note" rows={3} maxLength={2000} placeholder="Write what has been done so far." className={FIELD} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-base font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save progress update'}
      </button>
    </form>
  );
}
