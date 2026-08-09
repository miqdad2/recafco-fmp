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
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Actions</h2>
      <div className="space-y-4">
        {visible.activate && (
          <form action={handleActivate}>
            <input type="hidden" name="version" value={version} />
            <button
              type="submit"
              className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus"
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
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Close Contract
            </button>
          </form>
        )}

        {visible.terminate && (
          <form action={handleTerminate} className="space-y-2">
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
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Terminate Contract
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
