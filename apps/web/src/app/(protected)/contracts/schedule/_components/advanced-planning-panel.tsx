'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, FileSearch, List, Plus, Search, X } from 'lucide-react';
import type { ContractScheduleOverviewRow } from '@/lib/contracts-api';
import { GlobalSchedulePanel } from './global-schedule-panel';
import { QuickPlanModal } from './quick-plan-modal';
import { emptyQuickPlanForm, isFriday, quickPlanFormFromItem, type QuickPlanForm } from '../_lib/quick-plan';
import {
  CALENDAR_STATUSES,
  CALENDAR_STATUS_BADGE_CLASSES,
  CALENDAR_TEAMS,
  TEAM_ACCENT_CLASSES,
  buildCalendarItems,
  buildMonthGrid,
  filterCalendarItems,
  formatMonthLabel,
  itemReference,
  shiftMonth,
  stageTeamLabel,
  upcomingMilestones,
  type CalendarItem,
  type CalendarStatus,
  type CalendarTeam,
} from '../_lib/advanced-planning-helpers';
import { formatOverviewDelayDays, formatScheduleOverviewDate } from '../_lib/global-schedule-helpers';

interface Props {
  rows: ContractScheduleOverviewRow[];
  today: string;
  canEdit?: boolean;
}

type View = 'calendar' | 'list';

const MAX_ITEMS_PER_DAY = 3;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';
const linkBtnCls =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus';

function ItemButton({ item, onOpen }: { item: CalendarItem; onOpen: (item: CalendarItem) => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      title={`${itemReference(item)} — ${stageTeamLabel(item.stageName, item.team)} · ${item.status}`}
      className={`block w-full rounded border border-border border-l-[3px] ${TEAM_ACCENT_CLASSES[item.team]} bg-surface px-1.5 py-1 text-left shadow-sm transition hover:-translate-y-px hover:bg-surface-secondary hover:shadow focus:outline-none focus:ring-2 focus:ring-focus`}
    >
      <span className="block truncate text-[11px] font-semibold text-text-primary">{itemReference(item)}</span>
      <span className="block truncate text-[11px] text-text-secondary">{stageTeamLabel(item.stageName, item.team)}</span>
      <span className={`mt-0.5 inline-block rounded-full px-1.5 text-[10px] font-medium ${CALENDAR_STATUS_BADGE_CLASSES[item.status]}`}>{item.status}</span>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="col-span-2 text-text-primary break-words">{value}</dd>
    </div>
  );
}

function ItemDrawer({ item, onClose, onEditPlan }: { item: CalendarItem; onClose: () => void; onEditPlan?: (item: CalendarItem) => void }): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Milestone details"
        className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-text-muted">{itemReference(item)} · {item.projectName}</p>
            <h2 className="mt-0.5 truncate text-xl font-semibold text-text-primary">{item.stageName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CALENDAR_STATUS_BADGE_CLASSES[item.status]}`}>{item.status}</span>
              <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">{item.team}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <dl className="flex-1 divide-y divide-border overflow-y-auto px-5 py-2">
          <DetailRow label="Contract / Project" value={`${item.contractNumber} — ${item.projectName}`} />
          <DetailRow label="Job Order" value={item.jobOrderNumber ?? '—'} />
          <DetailRow label="Client" value={item.clientName} />
          <DetailRow label="Stage" value={item.stageName} />
          <DetailRow label="Responsible Team" value={item.team} />
          <DetailRow label="Planned Start" value={formatScheduleOverviewDate(item.plannedStartDate)} />
          <DetailRow label="Planned End" value={formatScheduleOverviewDate(item.plannedEndDate)} />
          <DetailRow label="Actual / Forecast" value={item.actualEndDate ? `Completed ${formatScheduleOverviewDate(item.actualEndDate)}` : '—'} />
          <DetailRow label="Delay" value={formatOverviewDelayDays(item.delayDays)} />
          <DetailRow label="Remarks" value={item.remarks || '—'} />
        </dl>
        <footer className="flex flex-wrap gap-2 border-t border-border bg-surface-secondary/50 px-5 py-4">
          <Link href={item.contractUrl} className={linkBtnCls}>Open Contract</Link>
          <Link href={item.scheduleUrl} className={linkBtnCls}>Open Schedule</Link>
          {onEditPlan && (
            <button type="button" onClick={() => onEditPlan(item)} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus">
              Edit Plan
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

/**
 * FMP-PLANNING-01 — Advanced Planning: Calendar View (default) + List View
 * (the unchanged global schedule table). Read-only: items open a details
 * drawer with links to the contract and its Schedule tab, where all editing
 * stays. Below `md` the month grid becomes an agenda list.
 */
export function AdvancedPlanningPanel({ rows, today, canEdit = false }: Props): React.JSX.Element {
  const [view, setView] = useState<View>('calendar');
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState<CalendarTeam | ''>('');
  const [status, setStatus] = useState<CalendarStatus | ''>('');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const router = useRouter();
  const [plan, setPlan] = useState<{ mode: 'create' | 'edit'; form: QuickPlanForm } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const allItems = useMemo(() => buildCalendarItems(rows, today), [rows, today]);
  const monthItems = useMemo(() => filterCalendarItems(allItems, { search, team, status, month }), [allItems, search, team, status, month]);
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of monthItems) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [monthItems]);
  const upcoming = useMemo(() => upcomingMilestones(allItems, { search, team, status }, today), [allItems, search, team, status, today]);
  const weeks = useMemo(() => buildMonthGrid(month), [month]);

  const openPlan = (date: string): void => setPlan({ mode: 'create', form: emptyQuickPlanForm(date) });
  const openEditPlan = (item: CalendarItem): void => {
    setSelected(null);
    setPlan({ mode: 'edit', form: quickPlanFormFromItem(item) });
  };
  const planSaved = (): void => {
    setPlan(null);
    setNotice('Activity planned successfully.');
    router.refresh();
  };

  const toggleDay = (date: string): void =>
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const tabCls = (active: boolean): string =>
    `inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus ${
      active ? 'bg-accent text-white' : 'bg-surface text-text-secondary hover:bg-surface-secondary'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Planning view" className="inline-flex overflow-hidden rounded-lg border border-border shadow-sm">
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} className={tabCls(view === 'calendar')}>
          <CalendarDays className="size-4" aria-hidden="true" />
          Calendar View
        </button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={tabCls(view === 'list')}>
          <List className="size-4" aria-hidden="true" />
          List View
        </button>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={() => openPlan(month === today.slice(0, 7) ? today : `${month}-01`)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          Plan Activity
        </button>
      )}
      </div>

      {view === 'list' ? (
        <GlobalSchedulePanel rows={rows} today={today} canEdit={canEdit} initialSearch={search} />
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface shadow-sm p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-[2] min-w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by contract, project, or client…"
                  aria-label="Search by contract, project, or client"
                  className={`${inputCls} w-full py-2.5 pl-9`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className={filterLabelCls}>Team</span>
                <select value={team} onChange={(e) => setTeam(e.target.value as CalendarTeam | '')} aria-label="Team" className={`${inputCls} w-auto min-w-40`}>
                  <option value="">All Teams</option>
                  {CALENDAR_TEAMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className={filterLabelCls}>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as CalendarStatus | '')} aria-label="Status" className={`${inputCls} w-auto min-w-32`}>
                  <option value="">All</option>
                  {CALENDAR_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className={filterLabelCls}>Month</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="rounded-md border border-border bg-surface p-2 text-text-secondary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => e.target.value && setMonth(e.target.value)}
                    aria-label="Month"
                    className={`${inputCls} w-auto`}
                  />
                  <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="rounded-md border border-border bg-surface p-2 text-text-secondary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="rounded-md border border-accent/40 bg-accent-light px-3 py-2 text-sm font-medium text-accent hover:border-accent focus:outline-none focus:ring-2 focus:ring-focus">
                    Today
                  </button>
                </div>
              </div>
            </div>
          </section>

          {notice && (
            <div role="status" className="flex items-center justify-between rounded-md border border-success bg-success-light px-4 py-2 text-sm text-success">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="ml-3"><X className="size-4" aria-hidden="true" /></button>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <div className="order-2 min-w-0 space-y-3 xl:order-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-text-primary">{formatMonthLabel(month)}</h2>
            {canEdit && <p className="text-xs text-text-muted">Click a date to plan an activity.</p>}
            <ul aria-label="Status legend" className="flex flex-wrap items-center gap-1.5">
              {CALENDAR_STATUSES.map((st) => (
                <li key={st} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CALENDAR_STATUS_BADGE_CLASSES[st]}`}>{st}</li>
              ))}
            </ul>
          </div>

          {monthItems.length === 0 && (
            <div className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 text-center px-6 ${canEdit ? "py-4" : "py-12"}`}>
              <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
              <p className="text-sm font-medium text-text-secondary mt-1">No planned milestones for this month.</p>
              <p className="text-xs text-text-muted">Create schedules from each contract’s Schedule tab.</p>
            </div>
          )}

          {(monthItems.length > 0 || canEdit) && (
            <>
              {/* Desktop / tablet-landscape month grid */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                <div className="grid grid-cols-7 border-b border-border bg-surface-secondary">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className={`px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-text-primary ${d === 'Fri' ? 'bg-warning-light/60' : ''}`}>
                      {d}
                      {d === 'Fri' && <span className="block text-[9px] font-medium normal-case tracking-normal text-text-muted">Friday off</span>}
                    </div>
                  ))}
                </div>
                {weeks.map((week) => (
                  <div key={week[0]!.date} className="grid grid-cols-7 border-b border-border last:border-b-0">
                    {week.map((day) => {
                      const dayItems = itemsByDay.get(day.date) ?? [];
                      const expanded = expandedDays.has(day.date);
                      const visible = expanded ? dayItems : dayItems.slice(0, MAX_ITEMS_PER_DAY);
                      return (
                        <div
                          key={day.date}
                          title={isFriday(day.date) ? 'Friday off' : undefined}
                          onClick={canEdit ? () => openPlan(day.date) : undefined}
                          className={`group min-h-16 min-w-0 ${canEdit ? 'cursor-pointer hover:bg-accent-light/40' : ''} border-r border-border p-1.5 last:border-r-0 ${!day.inMonth ? 'bg-surface-secondary/60' : isFriday(day.date) ? 'bg-warning-light/40' : 'bg-surface'} ${day.date === today ? 'ring-1 ring-inset ring-accent/50' : ''}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] ${day.date === today ? 'bg-accent font-bold text-white' : day.inMonth ? 'font-medium text-text-secondary' : 'text-text-muted'}`}>
                              {Number(day.date.slice(8))}
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPlan(day.date);
                                }}
                                aria-label={`Plan activity on ${formatScheduleOverviewDate(day.date)}`}
                                className="rounded p-0.5 text-text-muted opacity-0 hover:text-accent focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-focus group-hover:opacity-100"
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {visible.map((item) => (
                              <ItemButton key={item.id} item={item} onOpen={setSelected} />
                            ))}
                            {dayItems.length > MAX_ITEMS_PER_DAY && (
                              <button type="button" onClick={() => toggleDay(day.date)} className="text-[11px] font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-focus">
                                {expanded ? 'Show less' : `+${dayItems.length - MAX_ITEMS_PER_DAY} more`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Mobile / small tablet agenda */}
              <div className="md:hidden space-y-3">
                {[...itemsByDay.entries()].map(([date, dayItems]) => (
                  <section key={date} className="rounded-lg border border-border bg-surface p-3 shadow-sm">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{formatScheduleOverviewDate(date)}</h3>
                    <div className="space-y-1.5">
                      {dayItems.map((item) => (
                        <ItemButton key={item.id} item={item} onOpen={setSelected} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
          </div>

          <aside aria-label="Upcoming Milestones" className="order-1 min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm xl:order-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Upcoming Milestones ({upcoming.length})</h2>
                <p className="text-xs text-text-muted">Next planned activities</p>
              </div>
              {canEdit && (
                <button type="button" onClick={() => setView('list')} className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus">
                  Plan a Contract
                </button>
              )}
            </div>
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-secondary">No upcoming milestones found.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((item) => (
                  <li key={item.id} className="py-2.5 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-text-muted">{formatScheduleOverviewDate(item.date)}</span>
                      <span className={`rounded-full px-2 text-[10px] font-medium ${CALENDAR_STATUS_BADGE_CLASSES[item.status]}`}>{item.status}</span>
                    </div>
                    <p className="truncate text-sm font-semibold text-text-primary">{itemReference(item)}</p>
                    <p className="truncate text-xs text-text-secondary" title={`${item.projectName} — ${item.clientName}`}>{item.projectName} · {item.clientName}</p>
                    <p className="truncate text-xs text-text-secondary">{stageTeamLabel(item.stageName, item.team)}</p>
                    <div className="mt-1 flex gap-3 text-xs">
                      <Link href={item.scheduleUrl} className="font-medium text-accent hover:underline">Open Schedule</Link>
                      <Link href={item.contractUrl} className="font-medium text-accent hover:underline">Open Contract</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          </div>
        </>
      )}

      {selected && <ItemDrawer item={selected} onClose={() => setSelected(null)} {...(canEdit ? { onEditPlan: openEditPlan } : {})} />}
      {plan && <QuickPlanModal rows={rows} initial={plan.form} mode={plan.mode} onClose={() => setPlan(null)} onSaved={planSaved} />}
    </div>
  );
}
