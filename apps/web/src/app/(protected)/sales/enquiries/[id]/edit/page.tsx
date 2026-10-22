import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { salesApi } from '@/lib/sales-api';
import { getCurrentUserContext } from '../../../../contracts/_lib/get-user-permissions';
import { EnquiryForm } from '../../../_components/enquiry-form';
import { updateEnquiryAction } from '../../../actions';

export const metadata: Metadata = { title: 'Edit Enquiry — Sales & Enquiries — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditEnquiryPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [{ permissions }, res] = await Promise.all([getCurrentUserContext(), salesApi.enquiry(id)]);
  if (!permissions.includes('sales.update')) notFound();
  if (res.error) {
    if (res.error.status === 404) notFound();
    return <div role="alert" className="rounded-xl border border-error bg-error-light px-5 py-4 text-base text-error">The enquiry could not be loaded. Please refresh the page.</div>;
  }
  const e = res.data.enquiry;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Edit Enquiry</h1>
        <p className="mt-1 text-lg text-text-secondary">{e.enquiryNumber} · {e.companyName}. Earlier details are kept in the history.</p>
      </div>
      <EnquiryForm
        mode="edit"
        action={updateEnquiryAction.bind(null, id)}
        cancelHref={`/sales/enquiries/${id}`}
        initial={{
          companyName: e.companyName,
          contactPerson: e.contactPerson ?? '',
          contactNumber: e.contactNumber ?? '',
          email: e.email ?? '',
          projectName: e.projectName ?? '',
          scopeOfWork: e.scopeOfWork,
          estimatedValue: e.estimatedValue ?? '',
          typeOfWork: e.typeOfWork ?? '',
          projectLocation: e.projectLocation ?? '',
          nextFollowUpDate: e.nextFollowUpDate ?? '',
          remarks: e.remarks ?? '',
          source: e.source ?? '',
          estimatedValueSource: e.estimatedValueSource ?? '',
          expectedStartDate: e.expectedStartDate ?? '',
          expectedAwardDate: e.expectedAwardDate ?? '',
          additionalNotes: e.additionalNotes ?? '',
        }}
      />
    </div>
  );
}
