import { notFound } from 'next/navigation';
import { getCurrentUserContext } from '../contracts/_lib/get-user-permissions';
import { Eye } from 'lucide-react';
import { NewEnquiryButton } from './_components/new-enquiry-modal';

/**
 * FMP-SALES-01 — every /sales page needs sales.read (the API enforces it again on each call). Operational
 * permissions never open this area. Without the permission the pages answer "not found" so their existence
 * is not revealed.
 *
 * FMP-NAV-03 — one module header for every Sales page: the "Sales Activities" title with the New Client Enquiry action
 * (sales.create only). Module navigation (Dashboard / All Enquiries / Follow-ups) now lives in the FMP sidebar.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { permissions } = await getCurrentUserContext();
  if (!permissions.includes('sales.read')) notFound();

  // Read-only visitors (operational users with sales.read only) get one friendly line; every write control
  // elsewhere in /sales is simply not rendered for them, and the API refuses the requests anyway.
  const canChange = permissions.includes('sales.create') || permissions.includes('sales.update');
  const canCreate = permissions.includes('sales.create');

  return (
    <div data-sales-shell className="mx-auto flex min-h-full w-full max-w-[2200px] flex-col gap-2 px-5 pb-3 lg:px-8 2xl:gap-4 2xl:pb-4">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3 2xl:pt-4">
        <p className="text-3xl font-extrabold tracking-tight text-text-primary 2xl:text-4xl">Sales Activities</p>
        {canCreate && (
          <NewEnquiryButton />
        )}
      </header>
      {!canChange && (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary/60 px-4 py-2.5 text-base text-text-secondary">
          <Eye className="size-5 shrink-0" aria-hidden="true" />
          You can view Sales Activities. Adding and changing enquiries is done by management.
        </p>
      )}
      {children}
    </div>
  );
}
