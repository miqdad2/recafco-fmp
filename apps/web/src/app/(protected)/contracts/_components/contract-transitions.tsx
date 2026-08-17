import { activateContractAction, terminateContractAction, closeContractAction } from '../actions';
import { getVisibleContractTransitions, hasAnyVisibleTransition } from '../_lib/contract-ui-helpers';

interface Props {
  contractId: string;
  status: string;
  version: number;
  permissions: string[];
}

export function ContractTransitions({ contractId, status, version, permissions }: Props): React.JSX.Element | null {
  const visible = getVisibleContractTransitions(status, permissions);
  if (!hasAnyVisibleTransition(visible)) return null;

  async function handleActivate(): Promise<void> {
    'use server';
    await activateContractAction(contractId, version);
  }
  async function handleClose(): Promise<void> {
    'use server';
    await closeContractAction(contractId, version);
  }
  async function handleTerminate(formData: FormData): Promise<void> {
    'use server';
    await terminateContractAction(contractId, version, { error: null }, formData);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
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

      {visible.close && (
        <form action={handleClose}>
          <input type="hidden" name="version" value={version} />
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Close Contract
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
    </div>
  );
}
