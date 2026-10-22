import { notFound } from 'next/navigation';
import { getCurrentUserContext } from '../contracts/_lib/get-user-permissions';
import { Eye } from 'lucide-react';
import { SalesNav } from './_components/sales-nav';

/**
 * FMP-SALES-01 — every /sales page needs sales.read (the API enforces it again on each call). Operational
 * permissions never open this area. Without the permission the pages answer "not found" so their existence
 * is not revealed.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { permissions } = await getCurrentUserContext();
  if (!permissions.includes('sales.read')) notFound();

  // Read-only visitors (operational users with sales.read only) get one friendly line; every write control
  // elsewhere in /sales is simply not rendered for them, and the API refuses the requests anyway.
  const canChange = permissions.includes('sales.create') || permissions.includes('sales.update');

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-5 py-6 lg:px-8">
      <SalesNav />
      {!canChange && (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary/60 px-4 py-2.5 text-base text-text-secondary">
          <Eye className="size-5 shrink-0" aria-hidden="true" />
          You can view Sales &amp; Enquiries. Adding and changing enquiries is done by management.
        </p>
      )}
      {children}
    </div>
  );
}
