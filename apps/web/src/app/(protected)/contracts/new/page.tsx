import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { contractsApi } from '../../../../lib/contracts-api';
import { NewContractForm } from './_components/new-contract-form';

export const metadata: Metadata = { title: 'New Contract Register — RECAFCO FMP' };

export default async function NewContractPage(): Promise<React.JSX.Element> {
  const [deptsRes, plantsRes, locationsRes, peopleRes, dashboardRes] = await Promise.allSettled([
    contractsApi.departments(),
    contractsApi.plants(),
    contractsApi.locations(),
    contractsApi.people(),
    contractsApi.dashboard(),
  ]);

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value : [];
  const locations = locationsRes.status === 'fulfilled' ? locationsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];
  const scope = dashboardRes.status === 'fulfilled' ? dashboardRes.value.scope : undefined;

  return (
    <div className="px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={[
        { label: 'Contract Management', href: '/contracts/dashboard' },
        { label: 'Contract List', href: '/contracts' },
        { label: 'New Contract Register' },
      ]} />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">New Contract Register</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Creates a DRAFT contract. Activate it once all terms are confirmed.
        </p>
      </div>

      <NewContractForm depts={depts} plantsData={plantsData} locations={locations} people={people} scope={scope} />
    </div>
  );
}
