'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runOperationsDemoAction, type DemoActionResult } from './actions';

const BTN =
  'inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60';

const ACTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'seed', label: '1. Create / check demo contract', hint: 'Creates the isolated demonstration contract if it does not exist.' },
  { key: 'update', label: '2. Simulate progress update', hint: 'Accepts a new snapshot with higher produced / delivered / erected counts.' },
  { key: 'outage', label: '3. Simulate source outage', hint: 'Keeps the last figures and marks the update as delayed.' },
  { key: 'recovery', label: '4. Simulate recovery', hint: 'Accepts a new snapshot and clears the delayed state.' },
  { key: 'reset', label: 'Reset demo figures', hint: 'Back to the starting figures (92/25 excerpt).' },
];

export function DemoControls(): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DemoActionResult | null>(null);
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {ACTIONS.map((a) => (
          <li key={a.key} className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={BTN}
              disabled={pending}
              data-demo-action={a.key}
              onClick={() =>
                start(async () => {
                  setResult(await runOperationsDemoAction(a.key));
                  router.refresh();
                })
              }
            >
              {a.label}
            </button>
            <span className="text-sm text-text-secondary">{a.hint}</span>
          </li>
        ))}
      </ul>
      {result &&
        (result.error ? (
          <p role="alert" className="text-sm text-error">{result.error}</p>
        ) : (
          <p role="status" className="text-sm text-success">{result.message}</p>
        ))}
    </div>
  );
}
