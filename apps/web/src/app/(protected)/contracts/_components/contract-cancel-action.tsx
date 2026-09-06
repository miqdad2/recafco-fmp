'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { cancelContractAction } from '../actions';

interface Props {
  contractId: string;
  version: number;
  label: 'Remove Draft' | 'Cancel Contract';
  /**
   * CM-69D — optional custom trigger (e.g. a dropdown menu item) that opens
   * this exact same modal instead of the default standalone button. Omitted
   * everywhere this component was already used (ContractTransitions on the
   * Overview page's Contract Summary card) — that usage is 100% unaffected.
   * CM-69E — pass `renderTrigger={() => null}` (no visible trigger at all)
   * when this component is used purely as a controlled modal — see `open`/
   * `onOpenChange` below.
   */
  renderTrigger?: (open: () => void) => React.ReactNode;
  /**
   * CM-69E — controlled mode. When BOTH `open` and `onOpenChange` are
   * supplied, this component's modal visibility is driven entirely by the
   * parent instead of its own internal state. Required when the trigger
   * lives inside a parent that conditionally unmounts (e.g. a dropdown menu
   * that closes itself the moment an item is clicked) — an uncontrolled
   * component's own `open` state would be destroyed the instant its parent
   * unmounts it, which is exactly the bug this fixes (see contract-detail-
   * actions-menu.tsx: the menu item's onClick called this component's
   * internal `open()`, but the same click also closed the menu, unmounting
   * this component before it could ever render the modal). Omitted
   * everywhere else (ContractTransitions) — fully backward compatible.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * CM-69A — Safe Cancel/Void flow. Never a hard delete: the backend only ever
 * transitions DRAFT|ACTIVE -> CANCELLED (contracts.service.ts's cancel()),
 * keeping every related record (BOQ, workflow, payments, documents, issues,
 * claims, risks, schedule items, closeout requests, attachments, activity
 * log) exactly as it was. Reason is required; a UAT/test-cleanup reason like
 * "Created for UAT testing" is accepted as plain free text, same as any
 * other reason — there is no fixed reason dropdown.
 * CM-69D — `renderTrigger` lets the same modal be opened from a second
 * surface (the top-right Actions dropdown) without duplicating the modal.
 * CM-69E — modal title now matches `label` (was hardcoded "Cancel Contract"
 * even for a DRAFT contract's "Remove Draft" flow); on success this now
 * redirects to `/contracts` instead of only refreshing the current page,
 * since removing a wrongly-created contract from the active list is the
 * whole point of this action — the user needs to land back on the (now
 * correctly filtered, per CM-69C) list to see it gone. Also added the
 * `open`/`onOpenChange` controlled-mode props (see above) to fix the real
 * bug: this component instance was being unmounted by its own parent dropdown
 * before its internal `open` state could ever render the modal.
 * CM-69F — the submit button was always present in the DOM, but disabling
 * it purely because the (initially empty) Reason field hadn't been typed
 * into yet made it read, at a glance, as if there were no submit button at
 * all next to the always-enabled "Cancel" dismiss button. The submit button
 * now stays visible/enabled except while the request is genuinely in
 * flight; an empty reason instead shows a real, visible "Reason is
 * required." message on click. Its label now reads exactly `label`
 * ("Remove Draft"/"Cancel Contract", matching the modal title) with
 * "Removing…"/"Cancelling…" while pending, instead of a generic "Confirm
 * Cancellation" that didn't match either.
 * CM-69G — THE ACTUAL root cause of "submit button not visible": every
 * danger-styled element here used `bg-danger`/`text-danger`/`border-danger`,
 * but this app's real Tailwind v4 theme (apps/web/src/app/globals.css)
 * defines `--color-error`, not `--color-danger` — `danger` was never a real
 * token, so those classes silently generated NO CSS at all. `text-white` on
 * an unstyled (transparent) button background, sitting on the modal's white
 * surface, is genuinely invisible white-on-white text — not a conditional-
 * render bug (CM-69F's fix was real and necessary, but this was the deeper,
 * final cause). Every `danger` reference in this file is now `error`, the
 * real token. The same fix was applied to contract-detail-actions-menu.tsx,
 * contract-transitions.tsx, and contract-row-actions.tsx (all in this same
 * contract-lifecycle-actions family) — a wider, pre-existing `danger`-vs-
 * `error` mismatch spanning ~98 files across the whole app was discovered
 * but deliberately NOT touched outside this family; see CM-69G's report.
 */
export function ContractCancelAction({ contractId, version, label, renderTrigger, open, onOpenChange }: Props): React.JSX.Element {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  function openModal(): void {
    setReason('');
    setError(null);
    setIsOpen(true);
  }

  function closeModal(): void {
    setIsOpen(false);
  }

  function handleConfirm(): void {
    // CM-69F — validate with a real, visible message instead of only
    // disabling the submit button on an empty reason. A submit button
    // disabled purely because the (initially empty) reason field hasn't
    // been touched yet reads, at a glance, as if there is no submit button
    // at all — this was the real root cause of "Remove Draft does nothing/
    // isn't there": the button was always present, just permanently dimmed
    // until the user happened to type into Reason first. The button now
    // stays fully visible/enabled (except while the request is actually in
    // flight) and clicking it with an empty reason shows this exact message.
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelContractAction(contractId, version, reason);
      if (result.error) {
        // CM-69E — never silently close the modal on failure; the error
        // stays visible inside it until the user retries or closes manually.
        setError(result.error);
        return;
      }
      // CM-69E — preferred success behavior: redirect back to the Contract
      // List (rather than just router.refresh() and staying on the now-
      // cancelled contract's detail page) so the user immediately sees it's
      // gone from the default, CM-69C-filtered active view.
      router.push('/contracts');
    });
  }

  // CM-69F — submit label matches the modal title/action exactly ("Remove
  // Draft" / "Cancel Contract"), not a generic "Confirm Cancellation" that
  // didn't visually match what the user was told the action does.
  const pendingLabel = label === 'Remove Draft' ? 'Removing…' : 'Cancelling…';

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openModal)
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="rounded-md bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {label}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-lg shadow-lg border border-border w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">{label}</h2>
              <button type="button" onClick={closeModal} className="text-text-muted hover:text-text-primary" aria-label="Close">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {error && <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">{error}</div>}
              <p className="text-sm text-text-secondary">
                This will remove the contract from active views. Contract history and related records will be kept for audit.
              </p>
              <div>
                <label htmlFor="cancel-reason" className="block text-xs font-medium text-text-secondary mb-1">
                  Reason <span className="text-error">*</span>
                </label>
                <textarea
                  id="cancel-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="e.g. Created for UAT testing"
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-surface-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-error text-white hover:bg-error/90 disabled:opacity-60"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {isPending ? pendingLabel : label}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
