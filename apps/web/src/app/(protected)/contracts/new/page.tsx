import Link from 'next/link';
import type { Metadata } from 'next';
import { contractsApi } from '../../../../lib/contracts-api';
import { NewContractForm, NEW_CONTRACT_FORM_ID } from './_components/new-contract-form';

export const metadata: Metadata = { title: 'New Contract Register — RECAFCO FMP' };

// CM-56 — approved-design rebuild. depts/plants/locations/people were
// fetched here previously but never actually rendered anywhere in
// NewContractForm (confirmed by grep before removing) — ContractsService
// auto-assigns department/owner from the actor, no manual picker exists.
// Only the actor's own dashboard scope (for the "created under your
// department" banner) is still needed.
export default async function NewContractPage(): Promise<React.JSX.Element> {
  const dashboardRes = await contractsApi.dashboard().catch(() => null);
  const scope = dashboardRes?.scope;

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">New Contract Register</h1>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            Create a new contract by entering the basic details, scope, payment terms and BOQ items.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/contracts"
            className="inline-flex items-center h-11 px-5 rounded-md border border-border bg-surface text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Cancel
          </Link>
          {/* Real submit via the HTML form attribute — no client component
              needed just to trigger the same submit NewContractForm's own
              bottom "Save Draft" button already performs. */}
          <button
            type="submit"
            form={NEW_CONTRACT_FORM_ID}
            className="inline-flex items-center h-11 px-5 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Save Draft
          </button>
        </div>
      </div>

      <NewContractForm scope={scope} />
    </div>
  );
}
