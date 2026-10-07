import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { contractsApi } from '../../../../lib/contracts-api';
import type { ContractParty } from '../../../../lib/contracts-api';
import { getUserPermissions } from '../_lib/get-user-permissions';
import { PartyList } from './_components/party-list';

export const metadata: Metadata = { title: 'Contract Parties — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function ContractPartiesPage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  let parties: ContractParty[] = [];
  let loadFailed = false;
  try {
    parties = await contractsApi.parties({ includeInactive: true });
  } catch {
    loadFailed = true;
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1920px] mx-auto space-y-6">
      {loadFailed ? (
        <>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract Parties</h1>
          <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
            Parties could not be loaded. Please refresh the page.
          </div>
        </>
      ) : (
        <PartyList
          header={
            <div>
              <h1 className="text-3xl font-semibold text-text-primary tracking-tight">Contract Parties</h1>
              <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
                Add companies used as Customer (First Party) or Second Party in contracts.
              </p>
            </div>
          }
          parties={parties}
          canCreate={permissions.includes('contracts.create')}
          canUpdate={permissions.includes('contracts.update')}
        />
      )}
    </div>
  );
}
