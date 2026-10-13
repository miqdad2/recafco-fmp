'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { DrawingGroup, DrawingGroupItem, ElementCoverageData } from '@/lib/technical-api';
import { drawingGroupTransitionAction, releaseElementsAction } from '../../../actions';
import { isNoGroupingGroup } from '../../../_lib/element-status-helpers';
import { drawingRowStatus } from '../../../_lib/drawing-file-ui';
import { technicalStepHref } from '../../../_lib/technical-step-ui';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../../_lib/button-styles';
import { releaseSummary } from '../../../_lib/technical-workflow-helpers';
import {
  PRODUCTION_RECEIVES_TEXT,
  RELEASE_SUCCESS_TEXT,
  drawingSourceLabel,
  formatReleaseTime,
  groupDisplayName,
  productionStatusText,
  releaseBreakdown,
  releaseConfirmMessage,
  splitForRelease,
  waitingReason,
} from '../../../_lib/release-page-helpers';

// ---------------------------------------------------------------------------
// FMP-TECH-31 — Release to Production. Three clear views of the same elements:
// Ready to Release (final drawing uploaded, not released yet), Already Released
// (stay visible, with when / by whom / which drawing source) and Waiting Final
// Drawing (cannot be released). Releasing always asks for confirmation first.
// Release rules are unchanged: a group is released through its existing steps,
// individually covered elements through the element release; the API enforces
// the same checks. Update buttons need `canWrite`.
// ---------------------------------------------------------------------------

interface Props {
  contractId: string;
  items: DrawingGroupItem[] | null;
  coverage: ElementCoverageData | null;
  canWrite: boolean;
}

type Tab = 'ready' | 'released' | 'waiting';

interface PendingRelease {
  count: number;
  source: string;
  lines: string[];
  run: () => Promise<void>;
}

const btnCls = BTN_SECONDARY;
const primaryBtnCls = BTN_PRIMARY;

function groupLabel(g: DrawingGroup, itemName: string): string {
  if (isNoGroupingGroup(g)) return `All elements — ${itemName}`;
  const name = g.groupTitle ? `${g.groupTitle} · ` : '';
  return g.calculationRef ? `${name}${g.drawingNo} · Calc: ${g.calculationRef}` : `${name}${g.drawingNo}`;
}

function Badge({ label, classes }: { label: string; classes: string }): React.JSX.Element {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>{label}</span>;
}

export function ReleaseToProductionSection({ contractId, items, coverage, canWrite }: Props): React.JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('ready');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRelease | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const sections = splitForRelease(coverage?.elements ?? []);
  const readyGroups = releaseSummary(items).ready;
  const itemName = (id: string): string => items?.find((i) => i.boqItemId === id)?.description ?? '';
  const readyIndividual = sections.ready.filter((e) => e.group === null);

  const summary = coverage?.summary;
  const cards = [
    { label: 'Total Elements', value: summary?.totalElements ?? 0, warn: false },
    { label: 'Ready to Release', value: summary?.readyToRelease ?? 0, warn: false },
    { label: 'Waiting Final Drawing', value: summary?.notCovered ?? 0, warn: (summary?.notCovered ?? 0) > 0 },
    { label: 'Released to Production', value: summary?.released ?? 0, warn: false },
  ];

  async function releaseGroup(group: DrawingGroup): Promise<void> {
    // A group that has not been submitted / approved yet goes through those two existing steps first.
    const steps: ('submit' | 'approve' | 'release')[] = group.status === 'DRAFT' ? ['submit', 'approve', 'release'] : group.status === 'SUBMITTED' ? ['approve', 'release'] : ['release'];
    for (const step of steps) {
      const result = await drawingGroupTransitionAction(contractId, group.id, step);
      if (result.error) throw new Error(result.error);
    }
  }

  async function confirmRelease(): Promise<void> {
    if (!pending || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await pending.run();
      setMessage({ tone: 'ok', text: RELEASE_SUCCESS_TEXT });
      setPicked(new Set());
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Release failed. Please try again.' });
    }
    setBusy(false);
    setPending(null);
    // Released elements move to Already Released and the cards update.
    router.refresh();
  }

  function askReleaseGroup(g: DrawingGroup): void {
    setPending({
      count: g.pieceCount,
      source: 'Group Drawing',
      lines: [`${groupLabel(g, itemName(g.boqItemId))} · ${itemName(g.boqItemId)}`],
      run: () => releaseGroup(g),
    });
  }

  function askReleaseElements(): void {
    const chosen = readyIndividual.filter((e) => picked.has(e.id));
    if (chosen.length === 0) return;
    setPending({
      count: chosen.length,
      source: 'Individual Drawing',
      lines: releaseBreakdown(chosen),
      run: async () => {
        const result = await releaseElementsAction(contractId, chosen.map((e) => e.id));
        if (result.error) throw new Error(result.error);
      },
    });
  }

  const tabCls = (active: boolean): string =>
    `inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus ${active ? 'border-accent bg-accent-light text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary'}`;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'ready', label: 'Ready to Release', count: summary?.readyToRelease ?? readyGroups.length },
    { key: 'released', label: 'Already Released', count: summary?.released ?? 0 },
    { key: 'waiting', label: 'Waiting Final Drawing', count: summary?.notCovered ?? 0 },
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="release-title">
      <h2 id="release-title" className="text-base font-semibold text-text-primary">Release to Production</h2>
      <p className="mt-0.5 text-sm text-text-secondary">{PRODUCTION_RECEIVES_TEXT}</p>

      {items === null ? (
        <p className="mt-4 text-sm text-text-muted">Elements could not be loaded. Please refresh the page.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-md bg-surface-secondary/60 px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{c.label}</dt>
                <dd className={`mt-0.5 text-2xl font-bold tabular-nums ${c.warn ? 'text-warning' : 'text-text-primary'}`}>{c.value}</dd>
              </div>
            ))}
          </dl>

          {message && (
            <div role="status" className={`mt-3 rounded-md border px-4 py-2.5 text-sm ${message.tone === 'ok' ? 'border-success bg-success-light text-success' : 'border-error bg-error-light text-error'}`}>
              {message.text}
            </div>
          )}

          <div role="tablist" aria-label="Release to Production" className="mt-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={tabCls(tab === t.key)}>
                {t.label}
                <span className="tabular-nums text-xs opacity-80">{t.count}</span>
              </button>
            ))}
          </div>

          {/* A. Ready to Release */}
          {tab === 'ready' && (
            <div className="mt-4 space-y-5">
              {readyGroups.length === 0 && readyIndividual.length === 0 && (
                <p className="text-sm text-text-muted">
                  Nothing is ready to release yet. Upload drawings in{' '}
                  <Link href={technicalStepHref(contractId, 'final-drawing-files')} className="font-medium text-accent hover:underline">Final Drawing Files</Link>.
                </p>
              )}

              {readyGroups.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-text-primary">Drawing Groups Ready</h3>
                  <ul className="space-y-2">
                    {readyGroups.map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary">{groupLabel(g, itemName(g.boqItemId))}</p>
                          <p className="truncate text-xs text-text-secondary">
                            {itemName(g.boqItemId)} · {g.pieceCount} {g.pieceCount === 1 ? 'element' : 'elements'} · Drawing files: {g.fileCount}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge label="Group Drawing" classes="bg-info-light text-info" />
                          {canWrite && (
                            <button type="button" disabled={busy} onClick={() => askReleaseGroup(g)} className={primaryBtnCls}>Release Group</button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {readyIndividual.length > 0 && (
                <div>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">Individual Elements Ready</h3>
                    {canWrite && (
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => setPicked(new Set(readyIndividual.map((e) => e.id)))} className="text-xs font-medium text-accent hover:underline">Select all</button>
                        <span className="text-sm font-medium text-text-secondary" aria-live="polite">{picked.size} selected</span>
                        <button type="button" disabled={picked.size === 0 || busy} onClick={askReleaseElements} className={primaryBtnCls}>
                          {picked.size === 0 ? 'Release to Production (0)' : 'Release Selected to Production'}
                        </button>
                      </div>
                    )}
                  </div>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {readyIndividual.map((e) => {
                      const st = drawingRowStatus(e.individualFileCount, false);
                      return (
                        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                          {canWrite && (
                            <input
                              type="checkbox"
                              checked={picked.has(e.id)}
                              onChange={() =>
                                setPicked((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(e.id)) next.delete(e.id);
                                  else next.add(e.id);
                                  return next;
                                })
                              }
                              aria-label={`Select ${e.pieceCode}`}
                              className="size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                            />
                          )}
                          <div className="min-w-0 flex-1 basis-48">
                            <p className="text-sm font-medium text-text-primary">{e.pieceCode}</p>
                            <p className="truncate text-xs text-text-secondary" title={e.boqItemDescription}>{e.boqItemSortOrder}. {e.boqItemDescription} · Drawing files: {e.individualFileCount}</p>
                          </div>
                          <Badge label={st.label} classes={st.classes} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* B. Already Released */}
          {tab === 'released' && (
            <div className="mt-4">
              {sections.released.length === 0 ? (
                <p className="text-sm text-text-muted">No elements released yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      <tr>
                        <th className="px-3 py-2">Element</th>
                        <th className="px-3 py-2">BOQ Item</th>
                        <th className="px-3 py-2">Drawing Source</th>
                        <th className="px-3 py-2">Released</th>
                        <th className="px-3 py-2">Released By</th>
                        <th className="px-3 py-2">Production Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sections.released.map((e) => (
                        <tr key={e.id}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-text-primary">{e.pieceCode}</p>
                            <Badge label="Released to Production" classes="bg-success-light text-success" />
                          </td>
                          <td className="px-3 py-2 text-text-secondary">{e.boqItemSortOrder}. {e.boqItemDescription}</td>
                          <td className="px-3 py-2 text-text-secondary">
                            {drawingSourceLabel(e)}
                            {e.group ? <span className="block text-xs text-text-muted">{groupDisplayName(e)}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">{formatReleaseTime(e.releasedAt)}</td>
                          <td className="px-3 py-2 text-text-secondary">{e.releasedByName ?? '—'}</td>
                          <td className="px-3 py-2 text-text-secondary">{productionStatusText(e.currentStatus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* C. Waiting Final Drawing */}
          {tab === 'waiting' && (
            <div className="mt-4">
              {sections.waiting.length === 0 ? (
                <p className="text-sm text-text-muted">No elements are waiting for a final drawing.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {sections.waiting.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">{e.pieceCode}</p>
                        <p className="truncate text-xs text-text-secondary">{e.boqItemSortOrder}. {e.boqItemDescription} · {waitingReason(e)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge label="Waiting Final Drawing" classes="bg-warning-light text-warning" />
                        <Link href={technicalStepHref(contractId, 'final-drawing-files')} className={btnCls}>{canWrite ? 'Add Drawing' : 'Open Final Drawing Files'}</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-text-muted">Elements here cannot be released until a final drawing is uploaded.</p>
            </div>
          )}
        </>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="release-confirm-title">
          <div className="w-[min(96vw,520px)] rounded-lg border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h2 id="release-confirm-title" className="text-lg font-semibold text-text-primary">Release to Production?</h2>
              <button type="button" onClick={() => setPending(null)} disabled={busy} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-text-secondary">
              <p>{releaseConfirmMessage(pending.count)}</p>
              <dl className="space-y-1 rounded-md bg-surface-secondary/60 px-3 py-2 text-xs">
                <div className="flex gap-2"><dt className="font-medium text-text-primary">Elements:</dt><dd>{pending.count}</dd></div>
                <div className="flex gap-2"><dt className="font-medium text-text-primary">Drawing source:</dt><dd>{pending.source}</dd></div>
                <div className="flex gap-2"><dt className="shrink-0 font-medium text-text-primary">{pending.source === 'Group Drawing' ? 'Group:' : 'BOQ items:'}</dt>
                  <dd>
                    {pending.lines.map((l) => <span key={l} className="block">{l}</span>)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-5 py-3">
              <button type="button" onClick={() => setPending(null)} disabled={busy} className={`${btnCls} h-10 px-4 text-sm`}>Cancel</button>
              <button type="button" onClick={() => void confirmRelease()} disabled={busy} className={primaryBtnCls}>
                {busy ? 'Releasing…' : 'Release to Production'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
