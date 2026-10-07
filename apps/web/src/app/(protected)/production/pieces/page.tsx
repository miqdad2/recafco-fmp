import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authApi } from '@/lib/auth-api';
import { productionPiecesApi } from '@/lib/production-pieces-api';
import { Breadcrumbs } from '../../_components/breadcrumbs';
import { PieceProductionBoard } from './_components/piece-production-board';
import {
  PRODUCTION_STATUS_FILTERS,
  SUMMARY_CARDS,
  readFilterValues,
  buildPieceQuery,
  hasActiveFilters,
  emptyStateText,
  contractLabel,
} from './_lib/production-pieces-helpers';

export const metadata: Metadata = { title: 'Piece Production — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const fieldCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'mb-1 block text-xs font-medium text-text-secondary';

// FMP-BOQ-07 — Production & Planning → Piece Production. Shows the drawing-
// confirmed pieces Production works on and lets production users update their
// status through the shared piece engine. No production orders, batches or
// inventory are created here.
export default async function PieceProductionPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value ?? '';
  const me = await authApi.me(accessToken);
  const permissions: string[] = me.ok ? me.data.permissions : [];
  if (!permissions.includes('production.read')) notFound();

  const values = readFilterValues(await searchParams);
  const [list, summary, contracts, allowedStatuses] = await Promise.all([
    productionPiecesApi.list(buildPieceQuery(values)),
    productionPiecesApi.summary(),
    productionPiecesApi.contracts(),
    productionPiecesApi.allowedStatuses(),
  ]);

  const filtered = hasActiveFilters(values);
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
    return s ? `/production/pieces?${s}` : '/production/pieces';
  };

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 px-5 py-6 lg:px-6">
      <Breadcrumbs items={[{ label: 'Production', href: '/production/dashboard' }, { label: 'Piece Production' }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Piece Production</h1>
          <p className="mt-1 text-sm text-text-secondary">Update production status for drawing-confirmed pieces.</p>
        </div>
        <Link
          href="/production/dashboard"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
        >
          Back to Production Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-xs font-medium text-text-secondary">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{summary ? summary[card.key] : '—'}</p>
          </div>
        ))}
      </div>

      <form method="get" action="/production/pieces" className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="pf-search" className={labelCls}>Search</label>
            <input id="pf-search" name="search" type="search" defaultValue={values.search} placeholder="Piece code, drawing no or contract" className={fieldCls} />
          </div>
          <div>
            <label htmlFor="pf-status" className={labelCls}>Status</label>
            <select id="pf-status" name="status" defaultValue={values.status} className={fieldCls}>
              {PRODUCTION_STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pf-contract" className={labelCls}>Contract</label>
            <select id="pf-contract" name="contractId" defaultValue={values.contractId} className={fieldCls}>
              <option value="">All contracts</option>
              {(contracts ?? []).map((c) => (
                <option key={c.id} value={c.id}>{contractLabel(c)}</option>
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
            <Link href="/production/pieces" className="text-sm text-text-secondary underline hover:text-text-primary">
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
          <p className="text-base font-medium text-text-primary">{emptyStateText(filtered).title}</p>
          <p className="mt-1 text-sm text-text-secondary">{emptyStateText(filtered).help}</p>
        </div>
      )}

      {list && list.items.length > 0 && (
        <>
          <PieceProductionBoard key={list.items.map((p) => p.id + p.currentStatus).join('|')} pieces={list.items} allowedStatuses={allowedStatuses} />

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
