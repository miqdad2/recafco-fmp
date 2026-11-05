import Link from 'next/link';
import type { Metadata } from 'next';
import { contractsApi } from '../../../../lib/contracts-api';
import { salesApi } from '@/lib/sales-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import type { EnquiryContractPrefill } from '../_lib/enquiry-prefill';
import { NewContractForm, NEW_CONTRACT_FORM_ID } from './_components/new-contract-form';

export const metadata: Metadata = { title: 'New Contract Register — RECAFCO FMP' };

// CM-56 — approved-design rebuild. depts/plants/locations/people were
// fetched here previously but never actually rendered anywhere in
// NewContractForm (confirmed by grep before removing) — ContractsService
// auto-assigns department/owner from the actor, no manual picker exists.
// Only the actor's own dashboard scope (for the "created under your
// department" banner) is still needed.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NewContractPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const fromRaw = Array.isArray(sp['fromEnquiry']) ? sp['fromEnquiry'][0] : sp['fromEnquiry'];
  const [dashboardRes, permissions, firstParties, secondParties] = await Promise.all([
    contractsApi.dashboard().catch(() => null),
    getUserPermissions(),
    contractsApi.parties({ partyType: 'FIRST_PARTY' }).catch(() => []),
    contractsApi.parties({ partyType: 'SECOND_PARTY' }).catch(() => []),
  ]);
  const scope = dashboardRes?.scope;

  // FMP-SALES-09 — "Create Contract" from a Confirmed Sales enquiry: prefill only supported fields, and only for a
  // Confirmed, not-yet-linked enquiry the user may update. Anything else simply opens the normal empty form.
  let prefill: EnquiryContractPrefill | null = null;
  if (fromRaw && UUID.test(fromRaw) && permissions.includes('sales.update')) {
    const enq = await salesApi.enquiry(fromRaw);
    if (!enq.error && enq.data.enquiry.status === 'WON' && !enq.data.contract) {
      const e = enq.data.enquiry;
      const same = firstParties.filter((p) => p.name.trim().toLowerCase() === e.companyName.trim().toLowerCase());
      prefill = {
        enquiryId: e.id,
        enquiryNumber: e.enquiryNumber,
        companyName: e.companyName,
        title: e.projectName ?? e.companyName,
        firstPartyId: same.length === 1 ? same[0]!.id : '',
        clientContactName: e.contactPerson ?? '',
        clientContactPhone: e.contactNumber ?? '',
        projectSiteLocation: e.projectLocation ?? '',
        scopeDescription: e.scopeOfWork,
        notes: `Created from Sales enquiry ${e.enquiryNumber} (${e.companyName}).`,
      };
    }
  }

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

      <NewContractForm
        scope={scope}
        firstParties={firstParties}
        secondParties={secondParties}
        canAddParty={permissions.includes('contracts.create')}
        prefill={prefill}
      />
    </div>
  );
}
