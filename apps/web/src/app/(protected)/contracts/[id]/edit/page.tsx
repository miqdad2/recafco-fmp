import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '../../../_components/breadcrumbs';
import { contractsApi } from '../../../../../lib/contracts-api';
import { updateContractAction } from '../../actions';
import { EditContractForm } from './_components/edit-contract-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const contract = await contractsApi.get(id);
    return { title: `Edit ${contract.referenceNumber} — RECAFCO FMP` };
  } catch {
    return { title: 'Edit Contract — RECAFCO FMP' };
  }
}

export default async function EditContractPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [contractRes, deptsRes, plantsRes, peopleRes] = await Promise.allSettled([
    contractsApi.get(id),
    contractsApi.departments(),
    contractsApi.plants(),
    contractsApi.people(),
  ]);

  if (contractRes.status === 'rejected') notFound();

  const contract = (contractRes as PromiseFulfilledResult<Awaited<ReturnType<typeof contractsApi.get>>>).value;

  if (contract.status !== 'DRAFT') notFound();

  const depts = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
  const plantsData = plantsRes.status === 'fulfilled' ? plantsRes.value : [];
  const people = peopleRes.status === 'fulfilled' ? peopleRes.value : [];

  const boundAction = updateContractAction.bind(null, id, contract.version);

  return (
    <div className="min-h-full p-8">
      <div className="max-w-3xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Contracts Management', href: '/contracts' },
          { label: contract.referenceNumber, href: `/contracts/${id}` },
          { label: 'Edit' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Edit Contract</h1>
          <p className="mt-1 text-sm text-text-muted font-mono">{contract.referenceNumber}</p>
        </div>

        <EditContractForm
          contractId={id}
          boundAction={boundAction}
          depts={depts}
          plantsData={plantsData}
          people={people}
          defaultValues={{
            title: contract.title,
            counterpartyName: contract.counterpartyName,
            ...(contract.description !== undefined ? { description: contract.description } : {}),
            ...(contract.counterpartyContact !== undefined ? { counterpartyContact: contract.counterpartyContact } : {}),
            ...(contract.contractValue !== undefined ? { contractValue: contract.contractValue } : {}),
            ...(contract.currency !== undefined ? { currency: contract.currency } : {}),
            ...(contract.startDate !== undefined ? { startDate: contract.startDate } : {}),
            ...(contract.endDate !== undefined ? { endDate: contract.endDate } : {}),
            ...(contract.renewalNoticeDate !== undefined ? { renewalNoticeDate: contract.renewalNoticeDate } : {}),
            ownerUserId: contract.ownerUser.id,
            ...(contract.department !== undefined ? { departmentId: contract.department?.id } : {}),
            ...(contract.plant !== undefined ? { plantId: contract.plant?.id } : {}),
            ...(contract.notes !== undefined ? { notes: contract.notes } : {}),
          }}
        />
      </div>
    </div>
  );
}
