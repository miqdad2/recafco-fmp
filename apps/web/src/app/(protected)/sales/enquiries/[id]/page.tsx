import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Pencil, Phone, Mail, MapPin, UserRound } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import type { SalesActivity, SalesStatus } from '@/lib/sales-api';
import { getCurrentUserContext } from '../../../contracts/_lib/get-user-permissions';
import { ACTIVITY_LABELS, STATUS_LABELS, dueText, formatDate, formatKwd, NOT_ESTIMATED } from '../../_lib/sales-format';
import { BTN_SECONDARY, BucketBadge, FormMessage, Section, StatusBadge } from '../../_components/sales-ui';
import { EnquiryActions } from '../../_components/enquiry-actions';
import { FollowUpActions } from '../../_components/follow-up-actions';

export const metadata: Metadata = { title: 'Enquiry — Sales & Enquiries — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 py-2 sm:grid-cols-[12rem_1fr]">
      <dt className="text-base font-semibold text-text-secondary">{label}</dt>
      <dd className="min-w-0 break-words text-base text-text-primary">{children}</dd>
    </div>
  );
}
const dash = <span className="text-text-muted">—</span>;

function describeActivity(a: SalesActivity): React.ReactNode {
  const m = a.metadata ?? {};
  if (a.type === 'STATUS_CHANGE') {
    const from = typeof m['from'] === 'string' ? STATUS_LABELS[m['from'] as SalesStatus] : null;
    const to = typeof m['to'] === 'string' ? STATUS_LABELS[m['to'] as SalesStatus] : '';
    return (
      <>
        <span className="font-semibold">{from ? `${from} → ${to}` : to}</span>
        {typeof m['awardedValue'] === 'string' && <span> · Confirmed value {formatKwd(m['awardedValue'])}</span>}
        {typeof m['wonDate'] === 'string' && <span> · Confirmation date {formatDate(m['wonDate'])}</span>}
        {a.notes && <span className="block text-text-secondary">{a.notes}</span>}
      </>
    );
  }
  if (a.type === 'ENQUIRY_UPDATED') {
    const changes = Array.isArray(m['changes']) ? (m['changes'] as { label: string; from: string | null; to: string | null }[]) : [];
    return (
      <ul className="space-y-0.5">
        {changes.map((c) => (
          <li key={c.label} className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{c.label}:</span> {c.from ? <s className="text-text-muted">{c.from.length > 80 ? `${c.from.slice(0, 80)}…` : c.from}</s> : <em>empty</em>} → {c.to ? (c.to.length > 80 ? `${c.to.slice(0, 80)}…` : c.to) : <em>cleared</em>}
          </li>
        ))}
      </ul>
    );
  }
  return a.notes ?? '';
}

export default async function EnquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();

  const [{ permissions }, res] = await Promise.all([getCurrentUserContext(), salesApi.enquiry(id)]);
  if (res.error) {
    if (res.error.status === 404) notFound();
    return <div role="alert" className="rounded-xl border border-error bg-error-light px-5 py-4 text-base text-error">The enquiry could not be loaded. Please refresh the page.</div>;
  }
  const { enquiry: e, activities, followUps, today } = res.data;
  const canUpdate = permissions.includes('sales.update');
  const pending = followUps.filter((f) => f.status === 'PENDING');
  const statusHistory = activities.filter((a) => a.type === 'STATUS_CHANGE');
  const contactHistory = activities.filter((a) => a.type !== 'STATUS_CHANGE');
  const closed = e.status === 'WON' || e.status === 'LOST';

  return (
    <div className="space-y-6">
      {sp['saved'] && <FormMessage error={null} ok="Enquiry saved successfully." />}
      {sp['updated'] && <FormMessage error={null} ok="Changes saved." />}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-text-secondary">{e.enquiryNumber} · registered {formatDate(e.enquiryDate)}</p>
            <h1 className="mt-1 break-words text-4xl font-extrabold tracking-tight text-text-primary">{e.companyName}</h1>
            <div className="mt-3"><StatusBadge status={e.status} /></div>
          </div>
          {canUpdate && (
            <Link href={`/sales/enquiries/${e.id}/edit`} className={BTN_SECONDARY}>
              <Pencil className="size-5" aria-hidden="true" /> Edit Enquiry
            </Link>
          )}
        </div>
        {canUpdate && (
          <div className="mt-5 border-t border-border pt-5">
            <EnquiryActions enquiryId={e.id} status={e.status} today={today} />
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <Section title="Client Details">
            <dl className="divide-y divide-border">
              <Row label="Contact person"><span className="inline-flex items-center gap-2">{e.contactPerson ? <><UserRound className="size-4 text-text-muted" aria-hidden="true" />{e.contactPerson}</> : dash}</span></Row>
              <Row label="Contact number">{e.contactNumber ? <a href={`tel:${e.contactNumber}`} className="inline-flex items-center gap-2 font-medium text-blue-700 hover:underline"><Phone className="size-4" aria-hidden="true" />{e.contactNumber}</a> : dash}</Row>
              <Row label="Email">{e.email ? <a href={`mailto:${e.email}`} className="inline-flex items-center gap-2 font-medium text-blue-700 hover:underline"><Mail className="size-4" aria-hidden="true" />{e.email}</a> : dash}</Row>
              <Row label="Registered by">{e.createdBy.displayName}</Row>
            </dl>
          </Section>

          <Section title="Project Requirements">
            <dl className="divide-y divide-border">
              <Row label="Project">{e.projectName ?? dash}</Row>
              <Row label="Location">{e.projectLocation ? <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-text-muted" aria-hidden="true" />{e.projectLocation}</span> : dash}</Row>
              <Row label="Type of work">{e.typeOfWork ?? dash}</Row>
              <Row label="Scope of work"><p className="whitespace-pre-wrap">{e.scopeOfWork}</p></Row>
              <Row label="Remarks">{e.remarks ? <p className="whitespace-pre-wrap">{e.remarks}</p> : dash}</Row>
              {e.additionalNotes && <Row label="Additional notes"><p className="whitespace-pre-wrap">{e.additionalNotes}</p></Row>}
              {e.source && <Row label="Enquiry source">{e.source}</Row>}
              {(e.expectedStartDate || e.expectedAwardDate) && (
                <Row label="Expected dates">
                  {e.expectedStartDate && <span className="block">Start: {formatDate(e.expectedStartDate)}</span>}
                  {e.expectedAwardDate && <span className="block">Confirmation: {formatDate(e.expectedAwardDate)}</span>}
                </Row>
              )}
            </dl>
          </Section>

          <Section title="Meetings and Notes">
            {contactHistory.length === 0 ? (
              <p className="text-base text-text-secondary">No meetings or notes recorded yet.{canUpdate ? ' Use “Record Meeting / Note” above.' : ''}</p>
            ) : (
              <ol className="space-y-4">
                {contactHistory.map((a) => (
                  <li key={a.id} className="border-l-4 border-blue-300 pl-4">
                    <p className="text-sm font-semibold text-text-secondary">{ACTIVITY_LABELS[a.type]} · {formatDate(a.activityDate)} · {a.recordedBy.displayName}</p>
                    <div className="mt-0.5 whitespace-pre-wrap text-base text-text-primary">{describeActivity(a)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-purple-200 bg-purple-50/60 p-5 shadow-sm">
            <h2 className="text-xl font-bold text-text-primary">Estimated Project Value</h2>
            <p className={`mt-2 text-3xl font-extrabold tabular-nums ${e.estimatedValue ? 'text-purple-900' : 'text-text-muted'}`}>{formatKwd(e.estimatedValue) ?? NOT_ESTIMATED}</p>
            {e.estimatedValueSource && <p className="mt-1 text-sm text-text-secondary">Source: {e.estimatedValueSource}</p>}
            <p className="mt-2 text-sm text-text-secondary">A rough estimate for planning. It is not a contract value.</p>
            {e.status === 'WON' && (
              <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3">
                <p className="text-base font-bold text-green-800">Confirmed on {formatDate(e.wonDate)}</p>
                <p className="text-base text-green-900">Confirmed value: {formatKwd(e.awardedValue) ?? 'not recorded'}</p>
              </div>
            )}
            {e.status === 'LOST' && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-base font-bold text-red-800">Not proceeding{e.lostDate ? ` since ${formatDate(e.lostDate)}` : ''}</p>
                <p className="text-base text-red-900">{e.lostReason}</p>
              </div>
            )}
          </section>

          <Section title="Next Follow-up">
            {pending.length === 0 ? (
              <p className="text-base text-text-secondary">{closed ? 'No follow-up is scheduled.' : 'No follow-up is scheduled yet.'}{canUpdate && !closed ? ' Use “Add Follow-up” above.' : ''}</p>
            ) : (
              <ul className="space-y-4">
                {pending.map((f) => (
                  <li key={f.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-bold text-text-primary">{formatDate(f.followUpDate)}</p>
                      <BucketBadge bucket={f.bucket} />
                    </div>
                    <p className="text-sm text-text-secondary">{dueText(f.bucket, f.followUpDate, today)}{f.responsibleUser ? ` · ${f.responsibleUser.displayName}` : ''}</p>
                    {f.notes && <p className="mt-1 text-base text-text-primary">{f.notes}</p>}
                    {canUpdate && <div className="mt-3"><FollowUpActions followUpId={f.id} enquiryId={e.id} today={today} compact /></div>}
                  </li>
                ))}
              </ul>
            )}
            {followUps.some((f) => f.status !== 'PENDING') && (
              <details className="mt-4">
                <summary className="cursor-pointer rounded-md py-1 text-base font-semibold text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">Earlier follow-ups</summary>
                <ul className="mt-2 space-y-2">
                  {followUps.filter((f) => f.status !== 'PENDING').map((f) => (
                    <li key={f.id} className="rounded-lg bg-surface-secondary/60 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-text-primary">{formatDate(f.followUpDate)}</span>
                        <BucketBadge bucket={f.bucket} />
                      </div>
                      {(f.completionNotes || f.notes) && <p className="mt-0.5 text-text-secondary">{f.completionNotes ?? f.notes}</p>}
                      {f.completedAt && f.completedBy && <p className="text-text-muted">Completed by {f.completedBy.displayName}</p>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>

          <Section title="Status Changes">
            {statusHistory.length === 0 ? (
              <p className="text-base text-text-secondary">No status changes yet.</p>
            ) : (
              <ol className="space-y-3">
                {statusHistory.map((a) => (
                  <li key={a.id} className="border-l-4 border-text-muted/40 pl-4">
                    <p className="text-sm font-semibold text-text-secondary">{formatDate(a.activityDate)} · {a.recordedBy.displayName}</p>
                    <div className="text-base text-text-primary">{describeActivity(a)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
