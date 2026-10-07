import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authApi } from '@/lib/auth-api';
import { storageDeliveryPiecesApi } from '@/lib/storage-delivery-pieces-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PieceDeliveryBoard } from './_components/piece-delivery-board';
import {
  STORAGE_STATUS_FILTERS,
  STORAGE_SUMMARY_CARDS,
  readStorageFilterValues,
  buildStorageQuery,
  hasActiveStorageFilters,
  storageEmptyStateText,
  storageContractLabel,
} from './_lib/storage-pieces-helpers';

export const metadata: Metadata = { title: 'Piece Delivery — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const fieldCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'mb-1 block text-xs font-medium text-text-secondary';

// FMP-BOQ-08 — Storage Yard & Delivery → Piece Delivery. Shows the produced
// pieces Storage & Delivery works on and lets its users update their status
// (and optional location) through the shared piece engine. No delivery notes,
// stock movements or dispatch records are created here.
export default async function PieceDeliveryPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';
  const me = await authApi.me(accessToken);
  const permissions: string[] = me.ok ? me.data.permissions : [];
  if (!permissions.includes('storage_delivery.read')) notFound();

  const values = readStorageFilterValues(await searchParams);
  const [list, summary, contracts, allowedStatuses] = await Promise.all([
    storageDeliveryPiecesApi.list(buildStorageQuery(values)),
    storageDeliveryPiecesApi.summary(),
    storageDeliveryPiecesApi.contracts(),
    storageDeliveryPiecesApi.allowedStatuses(),
  ]);

  const filtered = hasActiveStorageFilters(values);
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  const pageHref = (page: number): string => {
    const qs = new URLSearchParams();
    if (values.status !== 'DEFAULT') qs.set('status', values.status);
    if (values.search) qs.set('search', values.search);
    if (values.contractId) qs.set('contractId', values.contractId);
    if (values.drawingNo) qs.set('drawingNo', values.drawingNo);
    if (values.boqItem) qs.set('boqItem', values.boqItem);
    if (page > 1) qs.set('page', String(page));
    const s = qs.toString();
    return s ? `/storage-delivery/pieces?${s}` : '/storage-delivery/pieces';
  };

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 px-5 py-6 lg:px-6">
      <Breadcrumbs items={[{ label: 'Storage Yard & Delivery' }, { label: 'Piece Delivery' }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Piece Delivery</h1>
          <p className="mt-1 text-sm text-text-secondary">Update storage and delivery status for produced pieces.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
        >
          Back to Platform Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STORAGE_SUMMARY_CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{summary ? summary[card.key] : '—'}</p>
          </div>
        ))}
      </div>

      <form method="get" action="/storage-delivery/pieces" className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="pf-search" className={labelCls}>Search</label>
            <input id="pf-search" name="search" type="search" defaultValue={values.search} placeholder="Piece code, drawing no or contract" className={fieldCls} />
          </div>
          <div>
            <label htmlFor="pf-status" className={labelCls}>Status</label>
            <select id="pf-status" name="status" defaultValue={values.status} className={fieldCls}>
              {STORAGE_STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pf-contract" className={labelCls}>Contract</label>
            <select id="pf-contract" name="contractId" defaultValue={values.contractId} className={fieldCls}>
              <option value="">All contracts</option>
              {(contracts ?? []).map((c) => (
                <option key={c.id} value={c.id}>{storageContractLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pf-drawing" className={labelCls}>Drawing No</label>
            <input id="pf-drawing" name="drawingNo" type="text" defaultValue={values.drawingNo} placeholder="Enter drawing number" className={fieldCls} />
          </div>
          <div>
            <label htmlFor="pf-boq" className={labelCls}>BOQ Item</label>
            <input id="pf-boq" name="boqItem" type="text" defaultValue={values.boqItem} placeholder="Enter item description" className={fieldCls} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus">
            Apply
          </button>
          {filtered && (
            <Link href="/storage-delivery/pieces" className="text-sm text-text-secondary underline hover:text-text-primary">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {!list && (
        <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
          Pieces could not be loaded. Please refresh the page.
        </div>
      )}

      {list && list.items.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
          <p className="text-base font-medium text-text-primary">{storageEmptyStateText(filtered).title}</p>
          <p className="mt-1 text-sm text-text-secondary">{storageEmptyStateText(filtered).help}</p>
        </div>
      )}

      {list && list.items.length > 0 && (
        <>
          <PieceDeliveryBoard key={list.items.map((p) => p.id + p.currentStatus).join('|')} pieces={list.items} allowedStatuses={allowedStatuses} />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
            <span>
              {list.total} {list.total === 1 ? 'piece' : 'pieces'} · Page {list.page} of {totalPages}
            </span>
            <span className="flex gap-2">
              {list.page > 1 && (
                <Link href={pageHref(list.page - 1)} className="rounded-md border border-border bg-surface px-3 py-1.5 hover:bg-surface-secondary">
                  Previous
                </Link>
              )}
              {list.page < totalPages && (
                <Link href={pageHref(list.page + 1)} className="rounded-md border border-border bg-surface px-3 py-1.5 hover:bg-surface-secondary">
                  Next
                </Link>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
