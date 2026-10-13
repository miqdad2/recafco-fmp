'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { BOQ_BUTTON_CLS, ContractRowActions, OPEN_BUTTON_CLS } from './contract-row-actions';
import { SCHEDULE_STATUS_BADGE_CLASSES, formatContractValue, formatScopeCompact, scheduleStatusLabel } from '../_lib/contract-ui-helpers';
import {
  attentionReasons,
  boqBar,
  countLabel,
  formatShortDate,
  matchesQuickFilter,
  paymentBar,
  projectStages,
  QUICK_FILTERS,
  statusBadge,
  timelineInfo,
} from '../_lib/contract-list-view-helpers';
import type { BarInfo, QuickFilter, StageInfo } from '../_lib/contract-list-view-helpers';
import type { ProjectProgress } from '../executive/_lib/project-overview-helpers';
import type { Contract } from '@/lib/contracts-api';

interface Props {
  contracts: Contract[];
  /** BOQ piece progress per contract id (null = could not be loaded or nothing to track). */
  boqProgress: Record<string, ProjectProgress | null>;
  page?: number;
  pageSize?: number;
  total?: number;
}

const TONE = { neutral: 'text-text-secondary', warning: 'text-warning', error: 'text-error' } as const;
const thCls = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-inverse/90';

function Bar({ info, color }: { info: BarInfo; color: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className={`text-sm ${info.percent === null ? 'text-text-muted' : 'text-text-primary'}`}>{info.text}</p>
      {info.percent !== null && (
        <div className="mt-1 h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-surface-secondary" role="presentation">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${info.percent}%` }} />
        </div>
      )}
    </div>
  );
}

function StatusCell({ contract }: { contract: Contract }): React.JSX.Element {
  const badge = statusBadge(contract.status);
  const reasons = attentionReasons(contract);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
      {reasons.length > 0 && (
        <span
          className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
          title={reasons.join(', ')}
        >
          Needs Attention
        </span>
      )}
    </div>
  );
}

function TimelineCell({ contract }: { contract: Contract }): React.JSX.Element {
  const t = timelineInfo(contract);
  if (!t.due && !t.start) return <span className="text-text-muted">—</span>;
  return (
    <div className="text-sm">
      {t.due && <p className="font-semibold text-text-primary">Due {t.due}</p>}
      {t.remaining && <p className={`text-xs font-medium ${TONE[t.remaining.tone]}`}>{t.remaining.text}</p>}
      {t.start && <p className="text-xs text-text-muted">Start {t.start}</p>}
    </div>
  );
}

const STAGE_BADGE: Record<StageInfo['text'], string> = {
  Done: 'bg-success/10 text-success',
  'In progress': 'bg-info/10 text-info',
  'Not started': 'bg-surface-secondary text-text-muted',
  '—': 'text-text-muted',
};

/** Four short rows (Technical, Production, Delivery, Erection) instead of four columns; only Done and In progress carry colour. */
function StagesCell({ contract, progress }: { contract: Contract; progress: ProjectProgress | null }): React.JSX.Element {
  const stages = projectStages(progress, contract.status);
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs">
      {stages.map((st) => (
        <div key={st.label} className="contents">
          <dt className="text-text-secondary">{st.label}</dt>
          <dd>
            <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${STAGE_BADGE[st.text]}`}>{st.text}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Identity({ contract }: { contract: Contract }): React.JSX.Element {
  return (
    <>
      <Link
        href={`/contracts/${contract.id}`}
        title={contract.title}
        className="line-clamp-2 font-semibold leading-snug text-text-primary hover:text-accent"
      >
        {contract.title}
      </Link>
      <span className="block font-mono text-[11px] text-text-muted">{contract.referenceNumber}</span>
    </>
  );
}

function ClientCell({ contract }: { contract: Contract }): React.JSX.Element {
  const client = contract.firstParty?.name ?? contract.counterpartyName;
  return (
    <>
      <span className="line-clamp-2 text-sm text-text-primary" title={client}>{client || '—'}</span>
      <span className="block text-xs text-text-muted">{contract.jobOrder ? `Job Order ${contract.jobOrder}` : '—'}</span>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-text-primary">{children}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-md border border-border bg-surface p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</h4>
      <dl className="space-y-2.5">{children}</dl>
    </section>
  );
}

const DASH = <span className="text-text-muted">—</span>;

/**
 * FMP-UI-43 — the read-only "Contract Details" card: three blocks (Contract Info,
 * Progress Info, Key Dates), "—" for anything missing, no inputs or dropdowns.
 * Schedule status is a plain badge here; it is changed on the contract page, not in the list.
 */
function Details({ contract, progress, showNav }: { contract: Contract; progress: ProjectProgress | null; showNav: boolean }): React.JSX.Element {
  const scope = formatScopeCompact(contract.scopeOfWork);
  const timeline = timelineInfo(contract);
  const payment = paymentBar(contract.paymentProgressPercent);
  const boq = boqBar(progress);
  const claims = contract.openClaimsCount ?? 0;
  const schedule = contract.effectiveScheduleStatus;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Contract Details</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <Block title="Contract Info">
          <Field label="Contract Type">{scope.fullList !== '—' ? scope.fullList : DASH}</Field>
          <Field label="Contract Manager">{contract.ownerUser.displayName || DASH}</Field>
          <Field label="Contract Value">{contract.contractValue ? formatContractValue(contract.contractValue, contract.currency) : DASH}</Field>
          <Field label="Last Updated">{formatShortDate(contract.updatedAt) ?? DASH}</Field>
        </Block>

        <Block title="Progress Info">
          <Field label="Schedule Status">
            {schedule ? (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SCHEDULE_STATUS_BADGE_CLASSES[schedule]}`}>
                {scheduleStatusLabel(schedule)}
              </span>
            ) : (
              DASH
            )}
          </Field>
          <Field label="Payment Progress">{payment.percent === null ? <span className={payment.text === '—' ? 'text-text-muted' : ''}>{payment.text}</span> : <Bar info={payment} color="bg-success" />}</Field>
          <Field label="Open Claims">{claims}</Field>
          <Field label="BOQ Status">{boq.text === '—' ? DASH : boq.text}</Field>
        </Block>

        <Block title="Key Dates">
          <Field label="Start Date">{timeline.start ?? DASH}</Field>
          <Field label="Forecast Completion">{timeline.due ?? DASH}</Field>
          <Field label="Days Remaining">
            {timeline.remaining ? <span className={TONE[timeline.remaining.tone]}>{timeline.remaining.text}</span> : DASH}
          </Field>
        </Block>
      </div>

      {showNav && (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Link href={`/contracts/${contract.id}`} className={OPEN_BUTTON_CLS}>Open Contract</Link>
          <Link href={`/contracts/${contract.id}/boq-progress`} className={BOQ_BUTTON_CLS}>Open BOQ Progress</Link>
        </div>
      )}
    </div>
  );
}

function DetailsToggle({ open, onClick, id }: { open: boolean; onClick: () => void; id: string }): React.JSX.Element {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={id}
      className="mt-2 inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-surface-secondary px-2.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {open ? 'Hide Details' : 'Show Details'}
    </button>
  );
}

/**
 * FMP-UI-40 — the Contract List, simplified. Seven readable columns on desktop
 * (no horizontal scrolling — columns share the width and long text wraps or
 * truncates), one card per contract on tablets and phones, and a "Details"
 * row for the fields that used to be extra columns (type, manager, value,
 * dates, claims, last updated, schedule status). FMP-UI-42: the Actions column is
 * just two buttons, Open and BOQ. FMP-UI-43: Details is a read-only information card —
 * nothing in the list is editable.
 */
export function ContractListTable({ contracts, boqProgress, page, pageSize, total }: Props): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);
  const [quick, setQuick] = useState<QuickFilter>('ALL');
  const now = new Date();
  const shown = contracts.filter((c) => matchesQuickFilter(c, boqProgress[c.id] ?? null, quick, now));
  const toggle = (id: string): void => setOpenId((cur) => (cur === id ? null : id));

  const actions = (c: Contract): React.JSX.Element => <ContractRowActions contractId={c.id} title={c.title} />;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Quick filters">
        {QUICK_FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={quick === chip.key}
            onClick={() => setQuick(chip.key)}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-focus',
              quick === chip.key ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface text-text-secondary hover:bg-surface-secondary',
            ].join(' ')}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-text-secondary">
        {quick === 'ALL' ? countLabel(contracts.length, page, pageSize, total) : `${shown.length} of the ${contracts.length} contracts on this page match`}
      </p>

      {shown.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-text-primary">No contracts found</p>
          <p className="mt-1 text-xs text-text-muted">Try clearing filters or searching another contract.</p>
        </div>
      )}

      {/* Desktop table */}
      <div className={`${shown.length === 0 ? 'hidden' : 'hidden lg:block'} rounded-lg border border-border bg-surface [&_thead_th:first-child]:rounded-tl-lg [&_thead_th:last-child]:rounded-tr-lg`}>
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-nav">
              <th className={`${thCls} w-[21%]`}>Contract / Project</th>
              <th className={`${thCls} w-[15%]`}>Client / Job Order</th>
              <th className={`${thCls} w-[11%]`}>Status</th>
              <th className={`${thCls} w-[12%]`}>BOQ</th>
              <th className={`${thCls} w-[17%]`}>Project Progress</th>
              <th className={`${thCls} w-[12%]`}>Timeline</th>
              <th className={`${thCls} w-[12%] text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-strong/40">
            {shown.map((c, index) => {
              const open = openId === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className={`align-top transition-colors hover:bg-accent/5 ${index % 2 === 1 ? 'bg-surface-secondary/40' : ''}`}>
                    <td className="px-3 py-4 pr-4">
                      <Identity contract={c} />
                      <DetailsToggle open={open} onClick={() => toggle(c.id)} id={`details-${c.id}`} />
                    </td>
                    <td className="px-3 py-4"><ClientCell contract={c} /></td>
                    <td className="px-3 py-4"><StatusCell contract={c} /></td>
                    <td className="px-3 py-4"><Bar info={boqBar(boqProgress[c.id] ?? null)} color="bg-info" /></td>
                    <td className="px-3 py-4"><StagesCell contract={c} progress={boqProgress[c.id] ?? null} /></td>
                    <td className="px-3 py-4"><TimelineCell contract={c} /></td>
                    <td className="px-3 py-4 text-right">{actions(c)}</td>
                  </tr>
                  {open && (
                    <tr id={`details-${c.id}`} className="bg-surface">
                      <td colSpan={7} className="px-4 py-4">
                        <Details contract={c} progress={boqProgress[c.id] ?? null} showNav />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tablet / phone cards */}
      <ul className="space-y-3 lg:hidden">
        {shown.map((c) => {
          const open = openId === c.id;
          return (
            <li key={c.id} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><Identity contract={c} /></div>
                <StatusCell contract={c} />
              </div>
              <div className="mt-2"><ClientCell contract={c} /></div>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="mb-0.5 text-xs text-text-muted">BOQ</p>
                  <Bar info={boqBar(boqProgress[c.id] ?? null)} color="bg-info" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-text-muted">Project Progress</p>
                  <StagesCell contract={c} progress={boqProgress[c.id] ?? null} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="mb-0.5 text-xs text-text-muted">Timeline</p>
                  <TimelineCell contract={c} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                {actions(c)}
                <DetailsToggle open={open} onClick={() => toggle(c.id)} id={`card-details-${c.id}`} />
              </div>
              {open && (
                <div id={`card-details-${c.id}`} className="mt-3 border-t border-border pt-3">
                  <Details contract={c} progress={boqProgress[c.id] ?? null} showNav={false} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
