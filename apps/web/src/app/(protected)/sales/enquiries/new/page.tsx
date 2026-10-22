import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUserContext } from '../../../contracts/_lib/get-user-permissions';
import { EnquiryForm } from '../../_components/enquiry-form';
import { createEnquiryAction } from '../../actions';

export const metadata: Metadata = { title: 'New Client Enquiry — Sales & Enquiries — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

export default async function NewEnquiryPage(): Promise<React.JSX.Element> {
  const { permissions } = await getCurrentUserContext();
  if (!permissions.includes('sales.create')) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">New Client Enquiry</h1>
        <p className="mt-1 text-lg text-text-secondary">Only the company and the scope of work are required. You can add the rest later.</p>
      </div>
      <EnquiryForm mode="create" action={createEnquiryAction} initial={{}} cancelHref="/sales/enquiries" />
    </div>
  );
}
