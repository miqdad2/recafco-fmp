import type { Metadata } from 'next';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { contractsApi } from '../../../../lib/contracts-api';
import { NewContractForm } from './_components/new-contract-form';

export const metadata: Metadata = { title: 'New Contract — RECAFCO FMP' };

export default async function NewContractPage(): Promise<React.JSX.Element> {
  const [deptsRes, plantsRes, peopleRes] = await Promise.allSettled([
    contractsApi.departments(),
    contractsApi.plants(),
    contractsApi.people(),
  ]);

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Contracts', href: '/contracts' },
          { label: 'New Contract' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">New Contract</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Creates a DRAFT contract. Activate it once all terms are confirmed.
          </p>
        </div>

        <NewContractForm depts={depts} plantsData={plantsData} people={people} />
      </div>
    </div>
  );
}
