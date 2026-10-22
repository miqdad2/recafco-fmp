import Link from 'next/link';
import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { salesApi } from '@/lib/sales-api';
import { getCurrentUserContext } from '../../contracts/_lib/get-user-permissions';
import { STATUS_LABELS, STATUS_ORDER, STATUS_FILTER_VALUE, formatDate, formatKwd, NOT_ESTIMATED } from '../_lib/sales-format';
import { NewEnquiryButton } from '../_components/new-enquiry-modal';
import { BTN_PRIMARY, BTN_SECONDARY, BucketBadge, EmptyState, INPUT_CLASS, StatusBadge } from '../_components/sales-ui';

export const metadata: Metadata = { title: 'All Enquiries — Sales & Enquiries — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

function href(search: string, status: string, month: string, page = 1): string {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);
  if (month) qs.set('month', month);
  if (page > 1) qs.set('page', String(page));
  const s = qs.toString();
  return `/sales/enquiries${s ? `?${s}` : ''}`;
}

export default async function EnquiryRegisterPage({ searchParams }: { searchParams: Promise<Params> }): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const search = one(sp['search']).trim();
  const status = one(sp['status']);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(one(sp['month'])) ? one(sp['month']) : '';
  const page = Math.max(1, Number.parseInt(one(sp['page']), 10) || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: '15' });
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);
  if (month) qs.set('month', month);

  const [{ permissions }, res] = await Promise.all([getCurrentUserContext(), salesApi.enquiries(qs)]);
  const canCreate = permissions.includes('sales.create');
  const filtered = Boolean(search || status || month);

  const pills: { key: string; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'open', label: 'Active' },
    ...STATUS_ORDER.map((s) => ({ key: STATUS_FILTER_VALUE[s], label: STATUS_LABELS[s] })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary">All Enquiries</h1>
        {canCreate && <NewEnquiryButton />}
      </div>

      <form method="get" action="/sales/enquiries" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="min-w-64 flex-1">
          <label htmlFor="search" className="mb-1.5 block text-base font-semibold text-text-primary">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input id="search" name="search" type="search" defaultValue={search} placeholder="Company, contact, phone, project or enquiry number" className={`${INPUT_CLASS} pl-12`} />
          </div>
        </div>
        <div>
          <label htmlFor="month" className="mb-1.5 block text-base font-semibold text-text-primary">Month</label>
          <input id="month" name="month" type="month" defaultValue={month} className={INPUT_CLASS} />
        </div>
        <button type="submit" className={BTN_PRIMARY}>Search</button>
        {filtered && <Link href="/sales/enquiries" className={BTN_SECONDARY}>Clear</Link>}
      </form>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {pills.map((p) => {
          const active = status === p.key;
          return (
            <Link key={p.key || 'all'} href={href(search, p.key, month)} aria-current={active ? 'true' : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-focus ${
                active ? 'border-text-primary bg-text-primary text-white' : 'border-border-strong bg-surface text-text-secondary hover:bg-surface-secondary'
              }`}>
              {p.label}
            </Link>
          );
        })}
      </nav>

      {res.error ? (
        <div role="alert" className="rounded-xl border border-error bg-error-light px-5 py-4 text-base text-error">The enquiries could not be loaded. Please refresh the page.</div>
      ) : res.data.items.length === 0 ? (
        filtered ? (
          <EmptyState title="No enquiries match" text="Try a different word, month or status, or clear the filters." action={{ href: '/sales/enquiries', label: 'Show all enquiries' }} />
        ) : (
          <EmptyState title="No enquiries yet" text="When a client visits, click “+ New Client Enquiry” and save their details. It takes less than a minute."
            actionNode={canCreate ? <NewEnquiryButton /> : undefined} />
        )
      ) : (
        <>
          <div className="@container space-y-3">
          <div className="hidden grid-cols-[8.5rem_1.5fr_1.3fr_11rem_9.5rem_11rem_8.5rem] gap-4 px-5 text-sm font-semibold uppercase tracking-wide text-text-secondary @6xl:grid" aria-hidden="true">
            <span>Enquiry No.</span><span>Company / Client</span><span>Project</span><span>Estimated Value</span><span>Status</span><span>Next Follow-up</span><span />
          </div>
          <ul className="space-y-3">
            {res.data.items.map((e) => {
              const overdue = e.nextFollowUpDate !== null && e.nextFollowUpDate < res.data.today && e.status !== 'WON' && e.status !== 'LOST';
              const dueToday = e.nextFollowUpDate === res.data.today && e.status !== 'WON' && e.status !== 'LOST';
              return (
                <li key={e.id} className="grid items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface p-5 shadow-sm sm:grid-cols-2 @6xl:grid-cols-[8.5rem_1.5fr_1.3fr_11rem_9.5rem_11rem_8.5rem]">
                  <p className="text-sm font-semibold text-text-secondary"><span className="@6xl:hidden">Enquiry No. </span>{e.enquiryNumber}</p>
                  <div className="min-w-0 sm:col-span-2 @6xl:col-span-1">
                    <p className="break-words text-lg font-bold text-text-primary">{e.companyName}</p>
                    {(e.contactPerson || e.contactNumber) && <p className="text-sm text-text-secondary">{[e.contactPerson, e.contactNumber].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <div className="min-w-0 break-words text-base text-text-primary"><span className="block text-xs font-semibold text-text-secondary @6xl:hidden">Project</span>{e.projectName ?? <span className="text-text-muted">—</span>}</div>
                  <div className={`text-base font-semibold ${e.estimatedValue ? 'text-purple-800' : 'text-text-muted'}`}><span className="block text-xs font-semibold text-text-secondary @6xl:hidden">Estimated value</span>{formatKwd(e.estimatedValue) ?? NOT_ESTIMATED}</div>
                  <div><span className="block text-xs font-semibold text-text-secondary @6xl:hidden">Status</span><StatusBadge status={e.status} /></div>
                  <div>
                    <span className="block text-xs font-semibold text-text-secondary @6xl:hidden">Next follow-up</span>
                    {e.nextFollowUpDate ? (
                      <>
                        <p className="text-base text-text-primary">{formatDate(e.nextFollowUpDate)}</p>
                        {(overdue || dueToday) && <BucketBadge bucket={overdue ? 'OVERDUE' : 'TODAY'} />}
                      </>
                    ) : <span className="text-text-muted">—</span>}
                  </div>
                  <Link href={`/sales/enquiries/${e.id}`} aria-label={`Open enquiry ${e.enquiryNumber}, ${e.companyName}`} className={`${BTN_SECONDARY} !min-h-11 justify-self-start @6xl:justify-self-end`}>
                    Open Enquiry
                  </Link>
                </li>
              );
            })}
          </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base text-text-secondary">
              {res.data.pagination.total} {res.data.pagination.total === 1 ? 'enquiry' : 'enquiries'} · page {res.data.pagination.page} of {res.data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && <Link href={href(search, status, month, page - 1)} className={BTN_SECONDARY}>Previous</Link>}
              {page < res.data.pagination.totalPages && <Link href={href(search, status, month, page + 1)} className={BTN_SECONDARY}>Next</Link>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
