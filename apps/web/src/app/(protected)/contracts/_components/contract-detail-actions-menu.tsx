'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { activateContractAction, terminateContractAction, closeContractFromCloseoutAction } from '../actions';
import { getVisibleContractTransitions, getClosureAction } from '../_lib/contract-ui-helpers';
import { ContractCancelAction } from './contract-cancel-action';

interface Props {
  contractId: string;
  status: string;
  version: number;
  permissions: string[];
  latestCloseoutRequestId: string | null;
  latestCloseoutRequestStatus: string | null;
}

type DialogState =
  | { type: 'none' }
  | { type: 'confirmActivate' }
  | { type: 'terminate' }
  | { type: 'confirmClose' }
  | { type: 'error'; message: string };

const TRIGGER_BASE_CLS = 'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-focus';
const MENU_ITEM_CLS = 'block w-full text-left px-4 py-2 hover:bg-surface-hover disabled:opacity-50';

/**
 * CM-69D — Contract Detail's top-right "Actions" dropdown. Was a permanently
 * disabled stub (layout.tsx) since it was first added — this replaces it
 * with a real menu, enabled whenever `getVisibleContractTransitions()`/
 * `getClosureAction()` say at least one real, permission-and-status-gated
 * action exists (same pure functions the Contract List row menu and the
 * Overview page's Contract Summary card already use — no new backend
 * logic, no new permission check invented here). Lives at the workspace
 * layout level (not just the Overview tab), so these actions are now
 * reachable from every tab, not only Overview — where ContractTransitions/
 * ContractClosureAction keep rendering exactly as before (this is a second,
 * parallel trigger surface for the same actions, not a replacement).
 * Cancel reuses ContractCancelAction's own modal (the real CM-69A modal, not
 * a re-implementation) — CM-69E fixed the menu item to drive it via
 * controlled `open`/`onOpenChange` state owned HERE (`isCancelOpen`), with
 * the actual <ContractCancelAction> instance rendered as a sibling of the
 * menu (always mounted, `renderTrigger={() => null}` suppresses its own
 * default button), not nested inside `{menuOpen && (...)}` — nesting it
 * there was the original bug: the same click that opened the modal also
 * closed the menu, unmounting the modal's own component instance before it
 * could render. Activate/Terminate/Close each get a lightweight confirm
 * step here (Activate's copy matches the List row's existing "Activate
 * Contract?" dialog; Terminate reuses the exact same terminateContractAction
 * via a synthesized FormData, since menu items hold their reason in local
 * state rather than a native form; Close reuses closeContractFromCloseoutAction
 * unchanged) — no lifecycle mutation ever fires directly from a menu click.
 * CM-69G — every `text-danger`/`bg-danger` reference here was invalid
 * (this app's real token is `error` — see contract-cancel-action.tsx's own
 * doc comment for the full explanation) and rendered with no color applied
 * at all, making the Terminate/Cancel menu items and Terminate's own submit
 * button effectively invisible-text-on-white. All now use the real `error`
 * token.
 */
export function ContractDetailActionsMenu({
  contractId,
  status,
  version,
  permissions,
  latestCloseoutRequestId,
  latestCloseoutRequestStatus,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [terminateReason, setTerminateReason] = useState('');
  const [isPending, startTransition] = useTransition();
  // CM-69E — Cancel's own open state MUST live here, not inside the
  // conditionally-rendered menu below: the menu item's onClick both opens
  // the cancel modal AND closes the menu in the same click, and a
  // <ContractCancelAction> instance rendered *inside* {menuOpen && (...)}
  // gets unmounted the instant menuOpen flips to false — destroying the
  // `open(true)` it was just told to do before it could ever render its
  // modal. Lifting this state up and rendering ContractCancelAction as a
  // sibling (always mounted, controlled via `open`/`onOpenChange`) is the
  // actual fix — this was the real root cause of "Remove Draft does nothing".
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const visible = getVisibleContractTransitions(status, permissions);
  const closure = getClosureAction(status, permissions, latestCloseoutRequestStatus);
  const hasAnyAction = visible.activate || visible.cancel || visible.terminate || closure.showRequestCloseout || closure.showCloseContract;

  function closeMenu(): void {
    setMenuOpen(false);
  }
  function closeDialog(): void {
    setDialog({ type: 'none' });
  }
  function openTerminateDialog(): void {
    setTerminateReason('');
    setDialog({ type: 'terminate' });
  }

  function runActivate(): void {
    startTransition(async () => {
      const result = await activateContractAction(contractId, version);
      if (result.error) {
        setDialog({ type: 'error', message: result.error });
        return;
      }
      closeDialog();
      router.refresh();
    });
  }

  function runTerminate(): void {
    const formData = new FormData();
    formData.set('reason', terminateReason);
    startTransition(async () => {
      const result = await terminateContractAction(contractId, version, { error: null }, formData);
      if (result.error) {
        setDialog({ type: 'error', message: result.error });
        return;
      }
      closeDialog();
      router.refresh();
    });
  }

  function runClose(): void {
    if (!latestCloseoutRequestId) return;
    startTransition(async () => {
      const result = await closeContractFromCloseoutAction(latestCloseoutRequestId, contractId);
      if (result.error) {
        setDialog({ type: 'error', message: result.error });
        return;
      }
      closeDialog();
      router.refresh();
    });
  }

  if (!hasAnyAction) {
    return (
      <button
        type="button"
        disabled
        title="No lifecycle actions are currently available for this contract"
        className={`${TRIGGER_BASE_CLS} border-border bg-surface-secondary text-text-muted cursor-not-allowed`}
      >
        Actions
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`${TRIGGER_BASE_CLS} border-border bg-surface text-text-primary hover:bg-surface-secondary`}
      >
        Actions
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeMenu} aria-hidden="true" />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-md shadow-md bg-surface border border-border py-1 text-sm">
            {visible.activate && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { closeMenu(); setDialog({ type: 'confirmActivate' }); }}
                className={`${MENU_ITEM_CLS} text-accent font-medium`}
              >
                Activate Contract
              </button>
            )}
            {visible.cancel && visible.cancelLabel && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { closeMenu(); setIsCancelOpen(true); }}
                className={`${MENU_ITEM_CLS} text-error font-medium`}
              >
                {visible.cancelLabel}
              </button>
            )}
            {visible.terminate && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { closeMenu(); openTerminateDialog(); }}
                className={`${MENU_ITEM_CLS} text-error font-medium`}
              >
                Terminate Contract
              </button>
            )}
            {closure.showRequestCloseout && (
              <Link
                href={`/contracts/${contractId}/closeout`}
                role="menuitem"
                onClick={closeMenu}
                className={`${MENU_ITEM_CLS} text-accent font-medium`}
              >
                Request Closeout
              </Link>
            )}
            {closure.showCloseContract && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { closeMenu(); setDialog({ type: 'confirmClose' }); }}
                className={`${MENU_ITEM_CLS} text-success font-medium`}
              >
                Close Contract
              </button>
            )}
          </div>
        </>
      )}

      {visible.cancel && visible.cancelLabel && (
        <ContractCancelAction
          contractId={contractId}
          version={version}
          label={visible.cancelLabel}
          renderTrigger={() => null}
          open={isCancelOpen}
          onOpenChange={setIsCancelOpen}
        />
      )}

      {dialog.type === 'confirmActivate' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-sm p-6 text-left">
            <h2 className="text-base font-semibold text-text-primary mb-2">Activate Contract?</h2>
            <p className="text-sm font-normal text-text-secondary mb-4">
              This will move the contract from Draft to Active and allow workflow tracking and task assignment.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeDialog} disabled={isPending} className="px-4 py-2 text-sm font-medium rounded border border-border hover:bg-surface-hover disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={runActivate} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50">
                {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {isPending ? 'Activating…' : 'Activate Contract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog.type === 'terminate' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">Terminate Contract</h2>
              <button type="button" onClick={closeDialog} className="text-text-muted hover:text-text-primary" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-text-secondary">
                This will move the contract to Terminated. Contract history and related records will be kept for audit.
              </p>
              <div>
                <label htmlFor="terminate-reason" className="block text-xs font-medium text-text-secondary mb-1">
                  Termination reason <span className="text-error">*</span>
                </label>
                <textarea
                  id="terminate-reason"
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  rows={3}
                  required
                  maxLength={2000}
                  placeholder="State the reason for termination…"
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button type="button" onClick={closeDialog} disabled={isPending} className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-surface-secondary disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={runTerminate}
                disabled={isPending || !terminateReason.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-error text-white hover:bg-error/90 disabled:opacity-60"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {isPending ? 'Terminating…' : 'Confirm Termination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog.type === 'confirmClose' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-sm p-6 text-left">
            <h2 className="text-base font-semibold text-text-primary mb-2">Close Contract?</h2>
            <p className="text-sm font-normal text-text-secondary mb-4">
              The closeout request has been approved. This will mark the contract as Closed.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeDialog} disabled={isPending} className="px-4 py-2 text-sm font-medium rounded border border-border hover:bg-surface-hover disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={runClose} disabled={isPending} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-success text-white hover:bg-success/90 disabled:opacity-50">
                {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {isPending ? 'Closing…' : 'Close Contract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog.type === 'error' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-sm p-6 text-left">
            <h2 className="text-base font-semibold text-error mb-2">Action failed</h2>
            <p className="text-sm font-normal text-text-secondary mb-4">{dialog.message}</p>
            <div className="flex justify-end">
              <button type="button" onClick={closeDialog} className="px-4 py-2 text-sm font-medium rounded border border-border hover:bg-surface-hover">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
