'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { computeContractRowActionPlan } from '../_lib/contract-ui-helpers';
import { activateContractAction } from '../actions';

interface Props {
  contractId: string;
  status: string;
  version: number;
  permissions: string[];
  /** Cross-referenced by the caller against the existing CM-38 closeout register (pendingOnly: true) — no new backend call added for this row. */
  hasPendingCloseout: boolean;
}

type DialogState =
  | { type: 'none' }
  | { type: 'confirmActivate' }
  | { type: 'error'; message: string };

/**
 * CM-43 — manager-friendly Contract List row actions: Open (always) plus a
 * More actions menu, replacing the old Open/Edit-only column. Same
 * dropdown/confirm-dialog architecture as
 * administration/users/_components/user-lifecycle-actions.tsx (useTransition
 * + router.refresh(), a small local dialog state machine for confirm/error),
 * not a new pattern. Activate reuses the existing activateContractAction
 * (already used by ContractTransitions on the detail page) — no new backend
 * call, no new mutation.
 * CM-55D — the status-driven "primary" action (Activate/Assign Tasks/Review
 * Closeout) used to render as a third always-visible button next to Open;
 * it's now the first item inside the More menu instead (highlighted in
 * accent color so it's still easy to spot), leaving only Open + the "···"
 * trigger visible in the row — a cleaner, narrower Action column. The
 * confirm-dialog flow for Activate is unchanged, just triggered from the
 * menu item instead of the old inline button.
 */
export function ContractRowActions({ contractId, status, version, permissions, hasPendingCloseout }: Props): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });

  const plan = computeContractRowActionPlan({ id: contractId, status }, permissions, hasPendingCloseout);
  const primaryIsMenuItem = plan.primary.type !== 'open';
  const hasMenu = primaryIsMenuItem || plan.moreActions.length > 0;

  function closeAll(): void {
    setMenuOpen(false);
    setDialog({ type: 'none' });
  }

  function runActivate(): void {
    startTransition(async () => {
      const res = await activateContractAction(contractId, version);
      if (res.error) {
        setDialog({ type: 'error', message: res.error });
      } else {
        closeAll();
        router.refresh();
      }
    });
  }

  return (
    <div className="relative inline-flex items-center gap-2 text-xs font-medium">
      <Link href={`/contracts/${contractId}`} className="text-accent hover:underline">
        Open
      </Link>

      {hasMenu && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex items-center justify-center size-6 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-secondary focus:outline-none disabled:opacity-50"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            ···
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-md shadow-md bg-surface border border-border py-1 text-sm">
                {plan.primary.type === 'activate' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setDialog({ type: 'confirmActivate' }); }}
                    disabled={isPending}
                    className="block w-full text-left px-4 py-2 hover:bg-surface-hover text-accent font-medium disabled:opacity-50"
                  >
                    Activate
                  </button>
                )}
                {plan.primary.type !== 'activate' && plan.primary.type !== 'open' && plan.primary.href && (
                  <Link
                    href={plan.primary.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 hover:bg-surface-hover text-accent font-medium"
                  >
                    {plan.primary.label}
                  </Link>
                )}
                {plan.moreActions.map((action) => (
                  <Link
                    key={action.key}
                    href={action.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 hover:bg-surface-hover text-text-primary font-normal"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {dialog.type !== 'none' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-sm mx-4 p-6 text-left">
            {dialog.type === 'confirmActivate' && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-2">Activate Contract?</h2>
                <p className="text-sm font-normal text-text-secondary mb-4">
                  This will move the contract from Draft to Active and allow workflow tracking and task assignment.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeAll}
                    disabled={isPending}
                    className="px-4 py-2 text-sm font-medium rounded border border-border hover:bg-surface-hover disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={runActivate}
                    disabled={isPending}
                    className="px-4 py-2 text-sm font-medium rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    {isPending ? 'Activating…' : 'Activate Contract'}
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'error' && (
              <>
                <h2 className="text-base font-semibold text-error mb-2">Action failed</h2>
                <p className="text-sm font-normal text-text-secondary mb-4">{dialog.message}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeAll}
                    className="px-4 py-2 text-sm font-medium rounded border border-border hover:bg-surface-hover"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
