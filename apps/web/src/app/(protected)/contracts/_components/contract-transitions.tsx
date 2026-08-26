import { activateContractAction, terminateContractAction } from '../actions';
import { getVisibleContractTransitions } from '../_lib/contract-ui-helpers';

interface Props {
  contractId: string;
  status: string;
  version: number;
  permissions: string[];
}

/**
 * Activate/Terminate only — the direct "Close Contract" action was removed
 * from here in CM-33; closing now requires an approved closeout request (see
 * ContractClosureAction, rendered alongside this component).
 */
export function ContractTransitions({ contractId, status, version, permissions }: Props): React.JSX.Element | null {
  const visible = getVisibleContractTransitions(status, permissions);
  if (!visible.activate && !visible.terminate) return null;

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
          <summary className="cursor-pointer list-none rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-focus">
            Terminate Contract
          </summary>
          <form
            action={handleTerminate}
            className="absolute left-0 top-full z-10 mt-2 w-72 space-y-2 rounded-md border border-border bg-surface p-3 shadow-lg"
          >
            <input type="hidden" name="version" value={version} />
            <div>
              <label htmlFor="reason" className="block text-xs font-medium text-text-secondary mb-1">
                Termination reason <span className="text-danger">*</span>
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
              className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Confirm Termination
            </button>
          </form>
        </details>
      )}
    </>
  );
}
