import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { formatKwd, formatDate, formatMonth, formatRate, dueText, daysBetween, STATUS_ORDER, STATUS_LABELS, STATUS_FILTER_VALUE, foldStatusCounts, NOT_ESTIMATED } from './sales-format';

const read = (p: string): string => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('Sales formatting', () => {
  it('KWD: unknown stays unknown (never 0), whole amounts have no decimals, fils keep 3', () => {
    expect(formatKwd(null)).toBeNull();
    expect(formatKwd(undefined)).toBeNull();
    expect(formatKwd('')).toBeNull();
    expect(formatKwd('125000')).toBe('KWD 125,000');
    expect(formatKwd('125000.5')).toBe('KWD 125,000.500');
    expect(formatKwd('0.125')).toBe('KWD 0.125');
    expect(NOT_ESTIMATED).toBe('Not estimated yet');
  });

  it('dates are calendar dates with no time-zone shifting', () => {
    expect(formatDate('2026-10-21')).toBe('21 Oct 2026');
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatDate(null)).toBe('—');
    expect(formatMonth('2026-10')).toBe('October 2026');
  });

  it('conversion rate shows N/A when not computable', () => {
    expect(formatRate(null)).toBe('N/A');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(33.3)).toBe('33.3%');
  });

  it('due wording', () => {
    expect(daysBetween('2026-10-21', '2026-10-18')).toBe(3);
    expect(dueText('OVERDUE', '2026-10-18', '2026-10-21')).toBe('3 days overdue');
    expect(dueText('OVERDUE', '2026-10-20', '2026-10-21')).toBe('1 day overdue');
    expect(dueText('TODAY', '2026-10-21', '2026-10-21')).toBe('Due today');
    expect(dueText('UPCOMING', '2026-10-26', '2026-10-21')).toBe('In 5 days');
  });

  it('plain-language statuses: six offered, in order; Contacted folds into Under Discussion', () => {
    expect(STATUS_ORDER.map((s) => STATUS_LABELS[s])).toEqual(['New', 'Follow-up Needed', 'Quotation Sent', 'Under Discussion', 'Confirmed', 'Not Proceeding']);
    expect(STATUS_LABELS.CONTACTED).toBe('Under Discussion');
    expect(STATUS_FILTER_VALUE.MEETING_DONE).toBe('MEETING_DONE,CONTACTED');
    expect(foldStatusCounts({ MEETING_DONE: 2, CONTACTED: 3, WON: 1 }).MEETING_DONE).toBe(5);
  });

  it('no CRM wording is left on screen (Won / Lost / Awarded / Opportunities / Meeting Done)', () => {
    const files = ['../page.tsx', '../enquiries/page.tsx', '../enquiries/[id]/page.tsx', '../_components/enquiry-actions.tsx', '../_components/new-enquiry-modal.tsx', '../_lib/sales-format.ts', '../../dashboard/page.tsx'];
    for (const f of files) {
      const text = read(f)
        .split(String.fromCharCode(10))
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
        .join(String.fromCharCode(10));
      // user-visible strings only: JSX text and quoted labels (identifiers like 'WON' / projectsWon are data names)
      for (const bad of ['>Won<', "'Won'", '"Won"', "'Lost'", '"Lost"', 'Awarded', 'Opportunities', 'Meeting Done', 'Potential Project Value', 'Open Enquiries', 'Monthly Conversion Rate', 'Projects Won']) {
        expect(text, `${f} still says ${bad}`).not.toContain(bad);
      }
    }
  });

  it('dashboard uses the approved plain labels', () => {
    const page = read('../page.tsx') + read('../_components/recent-enquiries.tsx') + read('../_components/follow-ups-panel.tsx');
    for (const l of ['Active Enquiries', 'Follow-ups Due', 'New Enquiries This Month', 'Estimated Value of Active Enquiries — KWD', 'Monthly Results', 'Confirmed Projects', 'Conversion This Month', 'Today’s Follow-ups', 'Follow-up date:', 'OpenEnquiryLink', 'Not set', 'Received', 'Enquiries still in progress.', 'View Active Enquiries', 'View Follow-ups', 'View This Month’s Enquiries', 'View All Enquiries', 'No matching enquiries']) expect(page).toContain(l);
    expect(page).not.toContain('Not yet Confirmed or Not Proceeding');
    expect(page).not.toContain('See all');
    expect(page).not.toContain('opens All Enquiries with that filter');
    expect(page).not.toContain('Follow-ups to Do');
  });

  it('dashboard shows four primary cards; only cards with an accurate list are links', () => {
    const page = read('../page.tsx');
    const kpis = page.slice(page.indexOf('const kpis'), page.indexOf('return (', page.indexOf('const kpis')));
    expect(kpis.match(/label: '/g)?.length).toBe(4);
    expect(kpis.match(/href: /g)?.length).toBe(3); // the estimated-value card has no matching list
    expect(read('../_components/follow-ups-panel.tsx')).toContain('actions && canUpdate && <FollowUpActions');
  });

  it('dashboard Recent Enquiries filter loads matching records on the server and applies immediately (no Show button)', () => {
    const c = read('../_components/recent-enquiries.tsx');
    expect(c).toContain('loadRecentEnquiriesAction');
    expect(c).toContain('onChange={(e) => choose(e.target.value)}');
    expect(c).not.toContain('>Show<');
    expect(read('../actions.ts')).toContain("pageSize: '8'");
  });

  it('inline status control: editors only, nothing saved by selecting, confirmation for Confirmed/Not Proceeding, stale-status protection', () => {
    const c = read('../_components/enquiry-status-control.tsx');
    expect(c).toContain('if (!canEdit) return null;');
    for (const l of ['Save Status', 'Cancel', 'Saving…', 'Status updated', 'Not saved', 'expectedStatus: saved', 'Change Status', 'It does not create a contract']) expect(c).toContain(l);
    expect(read('../actions.ts')).toContain('expectedStatus');
    for (const f of ['../enquiries/page.tsx', '../enquiries/[id]/page.tsx', '../_components/recent-enquiries.tsx']) expect(read(f)).toContain('EnquiryStatusControl');
    expect(read('../enquiries/page.tsx')).toContain("permissions.includes('sales.update')");
  });

  it('Add Activity: one shared popup (date, text, optional follow-up), no category; history renamed; viewers get no button', () => {
    const c = read('../_components/add-activity-button.tsx');
    for (const l of ['Add Activity', 'What happened?', 'Activity Date', 'Set Next Follow-up', 'Save Activity', 'Cancel', 'Saving…', 'Activity saved', 'requestId']) expect(c).toContain(l);
    expect(c).not.toContain('<select');
    for (const f of ['../_components/enquiry-actions.tsx', '../enquiries/page.tsx', '../_components/recent-enquiries.tsx']) expect(read(f)).toContain('AddActivityButton');
    expect(read('../enquiries/page.tsx')).toContain('canUpdate && <AddActivityButton');
    expect(read('../_components/recent-enquiries.tsx')).toContain('canUpdate && <AddActivityButton');
    const detail = read('../enquiries/[id]/page.tsx');
    expect(detail).toContain('Activity History');
    expect(detail + read('../_components/enquiry-actions.tsx')).not.toMatch(/Record Meeting|Meetings and Notes/);
  });

  it('Sales Activities: renamed everywhere users see it; dashboard order; no old name left in user-facing strings', () => {
    const page = read('../page.tsx');
    expect(page).toContain('Sales Activities');
    const i = (s: string): number => page.indexOf(s);
    expect(i('Key figures')).toBeLessThan(i('monthly-results'));
    expect(i('monthly-results')).toBeLessThan(i('<FollowUpsPanel'));
    expect(i('<FollowUpsPanel')).toBeLessThan(i('<RecentEnquiries'));
    expect(page).toContain('<DashboardClock serverToday={d.today} />');
    for (const f of ['../page.tsx', '../layout.tsx', '../enquiries/page.tsx', '../enquiries/[id]/page.tsx', '../enquiries/new/page.tsx', '../follow-ups/page.tsx', '../_components/sales-nav.tsx']) expect(read(f)).not.toMatch(/Sales (&|&amp;) Enquiries/);
  });

  it('one status editor: the enquiry page no longer has a competing Update Status panel; only different statuses are offered', () => {
    const actions = read('../_components/enquiry-actions.tsx');
    expect(actions).not.toContain('Update Status');
    expect(actions).not.toContain('StatusPanel');
    const c = read('../_components/enquiry-status-control.tsx');
    for (const l of ['Current Status:', 'Change Status', 'Save Status', 'options = STATUS_ORDER.filter((x) => x !== norm(saved))', 'type="radio"']) expect(c).toContain(l);
    expect(c).not.toContain('<select');
  });

  it('Sales module shell: one header (title + New Client Enquiry) and one navigation row on every page; enquiry page has breadcrumb and Back with restored query', () => {
    const layout = read('../layout.tsx');
    expect(layout).toContain('Sales Activities');
    expect(layout).toContain("permissions.includes('sales.create')");
    expect(layout.indexOf('<header')).toBeLessThan(layout.indexOf('<SalesNav'));
    expect(layout).toContain('md:sticky');
    const nav = read('../_components/sales-nav.tsx');
    for (const l of ['Dashboard', 'All Enquiries', 'Follow-ups', 'focus-visible:ring-2', 'min-h-12']) expect(nav).toContain(l);
    const detail = read('../enquiries/[id]/page.tsx');
    for (const l of ['Back to All Enquiries', 'aria-label="Breadcrumb"', 'backToList', 'enquiry.enquiryNumber'.replace('enquiry.', 'e.')]) expect(detail).toContain(l);
    expect(read('../enquiries/page.tsx')).toContain('?back=');
  });

  it('dashboard previews are fitted to the real space, not to screen sizes', () => {
    const hook = read('../_lib/use-fitted-count.ts');
    expect(hook).toContain('ResizeObserver');
    expect(hook).toContain('getBoundingClientRect');
    expect(hook).not.toMatch(/max-height|1366|1920|2560/);
    expect(read('../_components/recent-enquiries.tsx')).toContain('useFittedCount');
    expect(read('../_components/follow-ups-panel.tsx')).toContain('useFittedCount');
    expect(read('../_components/recent-enquiries.tsx')).toMatch(/Showing {count} of {total}/);
  });

  it('status filter offers All, Active, Follow-up Needed and More Statuses with every existing status', () => {
    const ui = read('../_components/sales-ui.tsx');
    for (const l of ['All', 'Active', 'More Statuses', 'STATUS_ORDER.map']) expect(ui).toContain(l);
    expect(ui).toContain("value: 'open'");
  });
});

describe('button system (FMP-SALES-08)', () => {
  const ui = read('../_components/sales-ui.tsx');
  /** WCAG relative luminance contrast of two #rrggbb colours. */
  const lum = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  it('every button colour pair is readable (>= 4.5:1), including hover and pressed shades', () => {
    const WHITE = '#ffffff', INK = '#0f172a';
    const pairs: Array<[string, string, string]> = [
      ['Open Enquiry', WHITE, '#1d4ed8'], ['Open Enquiry hover', WHITE, '#1e40af'], ['Open Enquiry pressed', WHITE, '#1e3a8a'],
      ['Add Activity / New Client Enquiry', WHITE, '#c62828'], ['Add hover (brightness 90%)', WHITE, '#b32424'], ['Add pressed (brightness 75%)', WHITE, '#951e1e'],
      ['Change Status / Reschedule', INK, '#fbbf24'], ['Change Status hover', INK, '#fcd34d'], ['Change Status pressed', INK, '#f59e0b'],
      ['Mark Completed', WHITE, '#15803d'], ['Mark Completed hover', WHITE, '#166534'], ['Mark Completed pressed', WHITE, '#14532d'],
      ['Cancel / Back', INK, '#ffffff'], ['Cancel hover', INK, '#f1f5f9'], ['Cancel pressed', INK, '#e2e8f0'],
      ['Selected tab', WHITE, '#1a2338'],
    ];
    for (const [name, fg, bg] of pairs) expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(4.5);
  });

  it('one definition per action: shared classes, 48px, 18px semibold, visible edge and shadow, all states', () => {
    for (const l of ['min-h-12', 'text-lg', 'font-semibold', 'border-2', 'shadow-sm', 'hover:', 'active:', 'focus-visible:ring-4', 'disabled:opacity-60']) expect(ui).toContain(l);
    for (const n of ['BTN_OPEN', 'BTN_ADD', 'BTN_STATUS', 'BTN_DONE', 'BTN_NEUTRAL']) expect(ui).toContain('export const ' + n);
    expect(ui).toContain('bg-blue-700');
    expect(ui).toContain('bg-accent');
    expect(ui).toContain('bg-amber-400');
    expect(ui).toContain('bg-green-700');
  });

  it('the same action looks the same everywhere: label and component per action', () => {
    const files = ['../page.tsx', '../enquiries/page.tsx', '../enquiries/[id]/page.tsx', '../follow-ups/page.tsx', '../_components/recent-enquiries.tsx', '../_components/follow-ups-panel.tsx'].map(read).join(' ');
    expect(files).not.toMatch(/>Open Enquiry</);
    expect(files).toContain('OpenEnquiryLink');
    expect(read('../_components/follow-up-actions.tsx')).toContain('BTN_DONE');
    expect(read('../_components/follow-up-actions.tsx')).toContain('BTN_STATUS');
    expect(read('../_components/enquiry-status-control.tsx')).toContain('BTN_STATUS');
    expect(read('../_components/add-activity-button.tsx')).toContain('BTN_ADD');
    expect(read('../_components/new-enquiry-modal.tsx')).toContain('BTN_ADD');
    expect(read('../_components/follow-up-actions.tsx')).not.toContain('Record Follow-up');
  });

  it('record actions are grouped Open Enquiry → Add Activity → Change Status, with Current Status outside the group', () => {
    const rows = read('../enquiries/page.tsx');
    expect(rows.indexOf('<OpenEnquiryLink')).toBeLessThan(rows.indexOf('<AddActivityButton'));
    expect(rows.indexOf('<AddActivityButton')).toBeLessThan(rows.indexOf('<EnquiryStatusControl'));
    expect(rows).toContain('<CurrentStatus');
    const cards = read('../_components/recent-enquiries.tsx');
    expect(cards.indexOf('<OpenEnquiryLink')).toBeLessThan(cards.indexOf('<AddActivityButton'));
    expect(cards.indexOf('<AddActivityButton')).toBeLessThan(cards.indexOf('<EnquiryStatusControl'));
    const nav = read('../_components/sales-nav.tsx');
    expect(nav).toContain('border-slate-400');
    expect(nav).toContain('bg-text-primary');
  });
});

describe('Sales area guards', () => {
  it('every /sales page is behind sales.read (layout) and write pages check their own permission', () => {
    expect(read('../layout.tsx')).toContain("permissions.includes('sales.read')");
    expect(read('../enquiries/new/page.tsx')).toContain("permissions.includes('sales.create')");
    expect(read('../enquiries/[id]/edit/page.tsx')).toContain("permissions.includes('sales.update')");
  });

  it('update controls are only rendered for sales.update', () => {
    const detail = read('../enquiries/[id]/page.tsx');
    expect(detail).toContain("const canUpdate = permissions.includes('sales.update')");
    expect(detail).toContain('{canUpdate && (');
    expect(read('../page.tsx')).toContain("permissions.includes('sales.create')");
  });

  it('the server actions file exports only async functions (Next.js rule)', () => {
    const src = read('../actions.ts');
    expect(src.startsWith("'use server'")).toBe(true);
    const exports = src.match(/^export .*/gm) ?? [];
    expect(exports.length).toBeGreaterThan(0);
    for (const line of exports) expect(line).toMatch(/^export async function /);
  });

  it('Sales appears in the sidebar only as the sales.read-gated sibling under Contract Management, and there is no export route', () => {
    const sidebar = fs.readFileSync(path.resolve(__dirname, '../../_components/sidebar.tsx'), 'utf8');
    expect(sidebar).toContain("permissions.includes('sales.read')");
    expect(sidebar.match(/href="\/sales"/g)?.length).toBe(2);
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (f.isDirectory()) walk(path.join(dir, f.name));
        else files.push(path.join(dir, f.name));
      }
    };
    walk(path.resolve(__dirname, '..'));
    expect(files.filter((f) => /route\.ts$/.test(f) || /export/i.test(path.basename(f)))).toEqual([]);
  });

  it('forms prevent double submit and keep the typed values after an error', () => {
    const form = read('../_components/enquiry-form.tsx');
    expect(form).toContain('disabled={pending}');
    expect(form).toContain('state.values[k]');
    expect(form).toContain("'Save Enquiry'");
    expect(form).toContain('Describe what the client needs, the type of work, quantities, and any important requirements.');
    expect(form).toContain('Leave blank if the project value is not known yet.');
  });

  it('New Client Enquiry opens a popup: native dialog, Esc / Cancel / X / outside click, double-submit blocked, refresh after save', () => {
    const m = read('../_components/new-enquiry-modal.tsx');
    expect(m).toContain('<dialog');
    expect(m).toContain('showModal()');
    expect(m).toContain('e.target === dialog.current'); // outside click
    expect(m).toContain('>Cancel</button>');
    expect(m).toContain('aria-label="Close"');
    expect(m).toContain('disabled={pending}');
    expect(m).toContain('router.refresh()');
    expect(m).toContain('keepFocusInside');
    expect(m).toContain('Enquiry saved successfully.');
    expect(m).toContain("'Save Enquiry'");
    // quick entry asks only the seven essentials
    const names = [...m.matchAll(/\sname="(\w+)"/g)].map((x) => x[1]);
    expect(names).toEqual(['companyName', 'contactPerson', 'contactNumber', 'scopeOfWork', 'estimatedValue', 'nextFollowUpDate', 'remarks']);
  });

  it('the dashboard and register open the popup instead of linking to a separate page', () => {
    expect(read('../layout.tsx')).toContain('<NewEnquiryButton');
    expect(read('../page.tsx')).not.toContain('/sales/enquiries/new');
    expect(read('../enquiries/page.tsx')).toContain('<NewEnquiryButton');
    expect(read('../enquiries/page.tsx')).not.toContain('/sales/enquiries/new');
  });
});
