'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFittedCount } from '../_lib/use-fitted-count';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { SalesEnquiry } from '@/lib/sales-api';
import { loadRecentEnquiriesAction } from '../actions';
import { NOT_ESTIMATED, STATUS_FILTER_VALUE, STATUS_LABELS, STATUS_ORDER, formatDate, formatKwd } from '../_lib/sales-format';
import { ContactLine, CurrentStatus, EmptyState, LatestActivity, OpenEnquiryLink } from './sales-ui';
import { AddActivityButton } from './add-activity-button';
import { EnquiryStatusControl } from './enquiry-status-control';
import { NewEnquiryButton } from './new-enquiry-modal';

/**
 * FMP-SALES-03 — Recent Enquiries with a status filter that works inside the dashboard. Choosing a filter asks the
 * server for the newest enquiries that really match it (the same status definitions and filter as All Enquiries,
 * with the same permission checks), not a re-filter of a small preloaded sample. "View All Enquiries" opens the
 * full list with the same filter. When the server data behind the dashboard changes (a follow-up was recorded, an
 * enquiry saved) the current filter is reloaded so the list never goes stale.
 */
const CHIP = 'inline-flex min-h-12 items-center rounded-full border px-3 text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
const ON = 'border-text-primary bg-text-primary text-white';
const OFF = 'border-border-strong bg-surface text-text-primary hover:bg-surface-secondary';

/** Cards the dashboard may offer; how many are shown depends on the space (useFittedCount). */
const MAX_SHOWN = 8;

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
  const listRef = useRef<HTMLUListElement>(null);
  const shown = useFittedCount(listRef, items.map((x) => `${x.id}:${x.status}:${x.latestActivity?.id ?? ''}`).join(',') + pending);
  const count = Math.min(shown, Math.min(items.length, MAX_SHOWN));
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
    <section aria-labelledby="recent-enquiries-title" className="rounded-xl border border-border bg-surface p-3 shadow-sm 2xl:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="recent-enquiries-title" className="flex flex-wrap items-baseline gap-x-3 text-xl font-bold text-text-primary 2xl:text-2xl min-[137.5rem]:text-3xl">
          Recent Enquiries
        </h2>
        <Link href={viewAll} className="inline-flex min-h-9 items-center gap-1 text-lg font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus 2xl:text-xl min-[137.5rem]:text-2xl">
          View All Enquiries <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter recent enquiries by status" className="flex flex-wrap items-center gap-2">
          {CHIPS.map((c) => (
            <button key={c.label} type="button" onClick={() => choose(c.value)} aria-pressed={status === c.value} className={`${CHIP} ${status === c.value ? ON : OFF}`}>
              {c.label}
            </button>
          ))}
          <select
            aria-label="More statuses" value={inChips ? '' : status} onChange={(e) => choose(e.target.value)}
            className={`min-h-12 rounded-full border px-3 text-base font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${!inChips ? ON : OFF}`}
          >
            <option value="" disabled={inChips}>More Statuses…</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={STATUS_FILTER_VALUE[s]}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
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
          <p className="rounded-lg border border-dashed border-border-strong bg-surface px-5 py-6 text-center text-xl font-semibold text-text-primary">No matching enquiries</p>
        )
      ) : (
        <ul ref={listRef} className={`space-y-3 transition-opacity ${pending ? 'opacity-50' : ''}`} aria-busy={pending}>
          {items.slice(0, MAX_SHOWN).map((e) => (
            <li key={e.id} className="rounded-xl border border-border bg-surface p-3 shadow-sm 2xl:p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="dense-clamp-1 line-clamp-2 min-w-0 break-words text-xl font-bold leading-snug text-text-primary 2xl:text-2xl min-[137.5rem]:text-3xl">{e.companyName}</p>
                <CurrentStatus status={e.status} />
              </div>
              <p className="dense-hide line-clamp-1 break-words text-lg text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl">{e.scopeOfWork}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                <div className="dense-hide"><ContactLine person={e.contactPerson} number={e.contactNumber} /></div>
                <p className={`text-lg font-semibold 2xl:text-xl min-[137.5rem]:text-2xl ${e.estimatedValue ? 'text-purple-900' : 'text-text-secondary'}`}>{formatKwd(e.estimatedValue) ?? NOT_ESTIMATED}</p>
                <p className="text-lg text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl"><span className="text-text-secondary">Next follow-up:</span> <span className="font-semibold">{e.nextFollowUpDate ? formatDate(e.nextFollowUpDate) : 'Not set'}</span></p>
                <p className="dense-hide text-lg text-text-primary 2xl:text-xl min-[137.5rem]:text-2xl"><span className="text-text-secondary">Received:</span> <span className="font-semibold">{formatDate(e.enquiryDate)}</span></p>
              </div>
              <div className="dense-hide"><LatestActivity activity={e.latestActivity ?? null} compact /></div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <OpenEnquiryLink href={`/sales/enquiries/${e.id}`} companyName={e.companyName} />
                {canUpdate && <AddActivityButton enquiryId={e.id} companyName={e.companyName} today={today} />}
                <EnquiryStatusControl enquiryId={e.id} enquiryNumber={e.enquiryNumber} companyName={e.companyName} status={e.status} canEdit={canUpdate} today={today} filter={status} filterLabel={label} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {!error && items.length > 0 && (
        <p role="status" aria-live="polite" className="mt-2 text-base text-text-secondary 2xl:text-lg min-[137.5rem]:text-xl" data-showing={`${count}/${total}`}>
          {pending ? <span className="inline-flex items-center gap-1"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading enquiries…</span> : <><span className="font-semibold text-text-primary">{status ? `${label}: ` : ''}Showing {count} of {total}</span> {total === 1 ? 'enquiry' : 'enquiries'}{count < total && <> · <Link href={viewAll} className="font-semibold text-accent hover:underline">View All Enquiries</Link></>}</>}
        </p>
      )}
    </section>
  );
}
