import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ContractPlaceholderPage } from '../_components/contract-placeholder-page';
import { getUserPermissions } from '../_lib/get-user-permissions';

export const metadata: Metadata = { title: 'Contract Schedule — RECAFCO FMP' };

export default async function ContractSchedulePage(): Promise<React.JSX.Element> {
  const permissions = await getUserPermissions();
  if (!permissions.includes('contracts.read')) notFound();

  return (
    <ContractPlaceholderPage
      breadcrumbLabel="Schedule"
      title="Contract Schedule"
      subtitle="View contract timelines, milestones and forecast completion dates."
      body="Schedule tracking will use saved contract dates and milestones. Detailed schedule tracking is not started yet."
    />
  );
}
