import { activateContractAction, terminateContractAction } from '../actions';
import { getVisibleContractTransitions } from '../_lib/contract-ui-helpers';
import { ContractCancelAction } from './contract-cancel-action';

interface Props {
  contractId: string;
  status: string;
  version: number;
  permissions: string[];
}

/**
 * Activate/Terminate/Cancel — the direct "Close Contract" action was removed
 * from here in CM-33; closing now requires an approved closeout request (see
 * ContractClosureAction, rendered alongside this component). CM-69A added
 * Cancel/Remove Draft (ContractCancelAction, a client component — its
 * required confirmation modal needs an explicit Cancel button, which the
 * plain server-action `<details>` pattern below can't close without JS) — a
 * safe void flow, never a hard delete.
 * CM-69G — the Terminate trigger/submit buttons here used the invalid
 * `bg-danger`/`text-danger` classes (this app's real token is `error`),
 * which generated no CSS at all — white text with no applied background,
 * invisible against this modal's white surface. Fixed to the real `error`
 * token; see contract-cancel-action.tsx's doc comment for the full story.
 */
export function ContractTransitions({ contractId, status, version, permissions }: Props): React.JSX.Element | null {
  const visible = getVisibleContractTransitions(status, permissions);
  if (!visible.activate && !visible.terminate && !visible.cancel) return null;

  async function handleActivate(): Promise<void> {
    'use server';
    await activateContractAction(contractId, version);
  }
  async function handleTerminate(formData: FormData): Promise<void> {
    'use server';
    await terminateContractAction(contractId, version, { error: null }, formData);
  }

  return (
    <>
      {visible.activate && (
        <form action={handleActivate}>
          <input type="hidden" name="version" value={version} />
          <button
            type="submit"
            className="rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Activate Contract
          </button>
        </form>
      )}

      {visible.terminate && (
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-focus">
            Terminate Contract
          </summary>
          <form
            action={handleTerminate}
            className="absolute left-0 top-full z-10 mt-2 w-72 space-y-2 rounded-md border border-border bg-surface p-3 shadow-lg"
          >
            <input type="hidden" name="version" value={version} />
            <div>
              <label htmlFor="reason" className="block text-xs font-medium text-text-secondary mb-1">
                Termination reason <span className="text-error">*</span>
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={2}
                required
                maxLength={2000}
                placeholder="State the reason for termination…"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Confirm Termination
            </button>
          </form>
        </details>
      )}

      {visible.cancel && visible.cancelLabel && (
        <ContractCancelAction contractId={contractId} version={version} label={visible.cancelLabel} />
      )}
    </>
  );
}
