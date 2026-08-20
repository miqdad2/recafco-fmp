import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ContractPlaceholderPage } from '../_components/contract-placeholder-page';
import { getUserPermissions } from '../_lib/get-user-permissions';

export const metadata: Metadata = { title: 'Claim Log — RECAFCO FMP' };

export default async function ContractClaimsPage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  return (
    <ContractPlaceholderPage
      breadcrumbLabel="Claim Log"
      title="Claim Log"
      subtitle="Track contract claims and claim status."
      body="Claim tracking backend is not started yet."
    />
  );
}
