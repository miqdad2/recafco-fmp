import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ContractPlaceholderPage } from '../_components/contract-placeholder-page';
import { getUserPermissions } from '../_lib/get-user-permissions';

export const metadata: Metadata = { title: 'Contract Issue Log — RECAFCO FMP' };

export default async function ContractIssuesPage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  return (
    <ContractPlaceholderPage
      breadcrumbLabel="Issue Log"
      title="Contract Issue Log"
      subtitle="Track open contract issues and follow-up actions."
      body="Issue tracking backend is not started yet."
    />
  );
}
