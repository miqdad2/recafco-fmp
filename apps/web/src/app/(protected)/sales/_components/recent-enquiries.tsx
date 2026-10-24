'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { SalesEnquiry } from '@/lib/sales-api';
import { loadRecentEnquiriesAction } from '../actions';
import { NOT_ESTIMATED, STATUS_FILTER_VALUE, STATUS_LABELS, STATUS_ORDER, formatDate, formatKwd } from '../_lib/sales-format';
import { BTN_SECONDARY, ContactLine, EmptyState } from './sales-ui';
import { EnquiryStatusControl } from './enquiry-status-control';
import { NewEnquiryButton } from './new-enquiry-modal';

/**
 * FMP-SALES-03 — Recent Enquiries with a status filter that works inside the dashboard. Choosing a filter asks the
 * server for the newest enquiries that really match it (the same status definitions and filter as All Enquiries,
 * with the same permission checks), not a re-filter of a small preloaded sample. "View All Enquiries" opens the
 * full list with the same filter. When the server data behind the dashboard changes (a follow-up was recorded, an
 * enquiry saved) the current filter is reloaded so the list never goes stale.
 */
const CHIP = 'inline-flex min-h-12 items-center rounded-full border px-5 text-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
const ON = 'border-text-primary bg-text-primary text-white';
const OFF = 'border-border-strong bg-surface text-text-primary hover:bg-surface-secondary';

const CHIPS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Active' },
  { value: STATUS_FILTER_VALUE.FOLLOW_UP, label: STATUS_LABELS.FOLLOW_UP },
];

interface Props {
  /** The unfiltered list as loaded with the page. */
  initial: SalesEnquiry[];
  initialTotal: number;
  /** Changes whenever the page's server data changes (used to reload the current filter). */
  signature: string;
  canCreate: boolean;
  /** sales.update: the status can be changed from each card. */
  canUpdate: boolean;
  today: string;
  newButtonClass: string;
}

export function RecentEnquiries({ initial, initialTotal, signature, canCreate, canUpdate, today, newButtonClass }: Props): React.JSX.Element {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  function load(next: string): void {
    const ticket = ++latest.current;
    startTransition(async () => {
      const res = await loadRecentEnquiriesAction(next);
      if (ticket !== latest.current) return; // a newer choice was made meanwhile
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setItems(res.items);
      setTotal(res.total);
    });
  }

  function choose(next: string): void {
    if (next === status) return;
    setStatus(next);
    load(next);
  }

  // Server data changed (router.refresh): All is replaced by the fresh list, any other filter is re-fetched.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (statusRef.current === '') {
      latest.current++;
      setItems(initial);
      setTotal(initialTotal);
      setError(null);
    } else {
      load(statusRef.current);
    }
  }, [signature]);

  const inChips = CHIPS.some((c) => c.value === status);
  const viewAll = `/sales/enquiries${status ? `?status=${encodeURIComponent(status)}` : ''}`;
  const label = status === '' ? 'All' : (CHIPS.find((c) => c.value === status)?.label ?? STATUS_LABELS[STATUS_ORDER.find((x) => STATUS_FILTER_VALUE[x] === status) ?? 'NEW_ENQUIRY']);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter recent enquiries by status" className="flex flex-wrap items-center gap-3">
          {CHIPS.map((c) => (
            <button key={c.label} type="button" onClick={() => choose(c.value)} aria-pressed={status === c.value} className={`${CHIP} ${status === c.value ? ON : OFF}`}>
              {c.label}
            </button>
          ))}
          <select
            aria-label="More statuses" value={inChips ? '' : status} onChange={(e) => choose(e.target.value)}
            className={`min-h-12 rounded-full border px-4 text-lg font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${!inChips ? ON : OFF}`}
          >
            <option value="" disabled={inChips}>More Statuses…</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={STATUS_FILTER_VALUE[s]}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <Link href={viewAll} className="inline-flex min-h-12 items-center gap-1 text-lg font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          View All Enquiries <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div role="status" aria-live="polite" className="mb-3 flex min-h-7 items-center gap-2 text-base text-text-secondary">
        {pending ? (
          <><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Loading enquiries…</>
        ) : error ? null : (
          <>{status ? `${label}: ` : ''}showing {items.length} of {total}</>
        )}
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-error bg-error-light px-5 py-4 text-lg text-error">{error} Please try again.</div>
      ) : items.length === 0 ? (
        pending ? <div className="h-24" /> : status === '' ? (
          <EmptyState
            title="No enquiries yet"
            text="When a client visits, click “+ New Client Enquiry” and save their details. It takes less than a minute."
            actionNode={canCreate ? <NewEnquiryButton className={newButtonClass} /> : undefined}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-border-strong bg-surface px-5 py-8 text-center text-xl font-semibold text-text-primary">No matching enquiries</p>
        )
      ) : (
        <ul className={`space-y-4 transition-opacity ${pending ? 'opacity-50' : ''}`} aria-busy={pending}>
          {items.map((e) => (
            <li key={e.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="min-w-0 break-words text-2xl font-bold leading-snug text-text-primary">{e.companyName}</p>
                <EnquiryStatusControl enquiryId={e.id} enquiryNumber={e.enquiryNumber} companyName={e.companyName} status={e.status} canEdit={canUpdate} today={today} filter={status} filterLabel={label} />
              </div>
              <p className="mt-1 line-clamp-2 break-words text-lg text-text-primary">{e.scopeOfWork}</p>
              <div className="mt-2"><ContactLine person={e.contactPerson} number={e.contactNumber} /></div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-lg sm:grid-cols-3">
                <div><dt className="text-base text-text-secondary">Estimated value</dt><dd className={`font-semibold ${e.estimatedValue ? 'text-purple-900' : 'text-text-secondary'}`}>{formatKwd(e.estimatedValue) ?? NOT_ESTIMATED}</dd></div>
                <div><dt className="text-base text-text-secondary">Received</dt><dd className="font-semibold text-text-primary">{formatDate(e.enquiryDate)}</dd></div>
                <div><dt className="text-base text-text-secondary">Next follow-up</dt><dd className="font-semibold text-text-primary">{e.nextFollowUpDate ? formatDate(e.nextFollowUpDate) : 'Not set'}</dd></div>
              </dl>
              <div className="mt-4">
                <Link href={`/sales/enquiries/${e.id}`} className={BTN_SECONDARY} aria-label={`Open enquiry: ${e.companyName}`}>Open Enquiry</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
