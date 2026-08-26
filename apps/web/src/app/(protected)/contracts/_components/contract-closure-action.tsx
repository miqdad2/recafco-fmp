import Link from 'next/link';
import { closeContractFromCloseoutAction } from '../actions';
import { getClosureAction } from '../_lib/contract-ui-helpers';

interface Props {
  contractId: string;
  contractStatus: string;
  permissions: string[];
  latestRequestStatus: string | null;
  latestRequestId: string | null;
}

const PENDING_LABELS: Record<string, string> = {
  SUBMITTED: 'Closeout Requested',
  UNDER_REVIEW: 'Closeout Under Review',
};

/**
 * CM-33 — replaces the old direct "Close Contract" button. A contract can
 * only be closed through an approved closeout request; this renders exactly
 * one of: a link to start a request, a pending-status badge, the final
 * "Close Contract" button (only once approved), or nothing (DRAFT/no actor
 * permission). Closed contracts show nothing here — the Closeout tab shows
 * the final closed details instead.
 */
export function ContractClosureAction({
  contractId,
  contractStatus,
  permissions,
  latestRequestStatus,
  latestRequestId,
}: Props): React.JSX.Element | null {
  const action = getClosureAction(contractStatus, permissions, latestRequestStatus);

  if (!action.showRequestCloseout && !action.pendingStatus && !action.showCloseContract) {
    return null;
  }

  async function handleCloseContract(): Promise<void> {
    'use server';
    if (latestRequestId) {
      await closeContractFromCloseoutAction(latestRequestId, contractId);
    }
  }

  if (action.showRequestCloseout) {
    return (
      <Link
        href={`/contracts/${contractId}/closeout`}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Request Closeout
      </Link>
    );
  }

  if (action.pendingStatus) {
    return (
      <Link
        href={`/contracts/${contractId}/closeout`}
        className="inline-flex items-center gap-1.5 rounded-md border border-warning bg-warning-light px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning-light/70 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {PENDING_LABELS[action.pendingStatus]}
      </Link>
    );
  }

  if (action.showCloseContract) {
    return (
      <form action={handleCloseContract}>
        <button
          type="submit"
          className="rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-focus"
          title="Closeout request has been approved"
        >
          Close Contract
        </button>
      </form>
    );
  }

  return null;
}
