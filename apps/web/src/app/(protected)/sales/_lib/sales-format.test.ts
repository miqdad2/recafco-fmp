import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { formatKwd, formatDate, formatMonth, formatRate, dueText, daysBetween, STATUS_ORDER, STATUS_LABELS, STATUS_FILTER_VALUE, foldStatusCounts, NOT_ESTIMATED, TASK_NOT_RECORDED, taskText, compactKwd, monthConversionText } from './sales-format';

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

  it('plain-language statuses: eight offered, in order (two waiting statuses added); Contacted folds into Under Discussion', () => {
    expect(STATUS_ORDER.map((s) => STATUS_LABELS[s])).toEqual(['New', 'Waiting for Drawings', 'Follow-up Needed', 'Quotation Sent', 'Under Discussion', 'Waiting for Client Response', 'Confirmed', 'Not Proceeding']);
    expect(STATUS_FILTER_VALUE.WAITING_FOR_DRAWINGS).toBe('WAITING_FOR_DRAWINGS');
    expect(STATUS_FILTER_VALUE.WAITING_FOR_CLIENT).toBe('WAITING_FOR_CLIENT');
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
    for (const l of ['Active Enquiries', 'Follow-ups Due', 'New Enquiries This Month', 'Estimated Value of Active Enquiries — KWD', 'Monthly Results', 'Confirmed Enquiries', 'Estimated Confirmed Value — KWD', 'Contracts Created', 'Enquiry Conversion', 'View Enquiries', 'Confirmed this month', 'For enquiries confirmed this month', 'Created from enquiries this month', 'View Contracts', 'Today’s Follow-ups', 'Follow-up date:', 'OpenEnquiryLink', 'Not set', 'Received', 'Enquiries still in progress.', 'View Active Enquiries', 'View Follow-ups', 'View This Month’s Enquiries', 'View All Enquiries', 'No matching enquiries']) expect(page).toContain(l);
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
    for (const l of ['Save Status', 'Cancel', 'Saving…', 'Status updated', 'Not saved', 'expectedStatus: saved', 'Change Status', 'Confirm Enquiry', 'Save Confirmation', 'The client has agreed to proceed.', 'Confirmation Date', 'Confirmation Notes', 'Enquiry confirmed.']) expect(c).toContain(l);
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
    for (const f of ['../page.tsx', '../layout.tsx', '../enquiries/page.tsx', '../enquiries/[id]/page.tsx', '../enquiries/new/page.tsx', '../follow-ups/page.tsx']) expect(read(f)).not.toMatch(/Sales (&|&amp;) Enquiries/);
  });

  it('one status editor: the enquiry page no longer has a competing Update Status panel; only different statuses are offered', () => {
    const actions = read('../_components/enquiry-actions.tsx');
    expect(actions).not.toContain('Update Status');
    expect(actions).not.toContain('StatusPanel');
    const c = read('../_components/enquiry-status-control.tsx');
    for (const l of ['Current Status:', 'Change Status', 'Save Status', 'options = STATUS_ORDER.filter((x) => x !== norm(saved))', 'Choose Status']) expect(c).toContain(l);
    expect(c).not.toContain('type="radio"');
  });

  it('Sales module shell: one header (title + New Client Enquiry); module navigation is in the FMP sidebar; enquiry page has breadcrumb and Back with restored query', () => {
    const layout = read('../layout.tsx');
    expect(layout).toContain('Sales Activities');
    expect(layout).toContain("permissions.includes('sales.create')");
    expect(layout).not.toContain('SalesNav');
    expect(fs.existsSync(path.resolve(__dirname, '../_components/sales-nav.tsx'))).toBe(false);
    const sidebar = fs.readFileSync(path.resolve(__dirname, '../../_components/sidebar.tsx'), 'utf8');
    for (const l of ['SALES_SUBMENU', "href: '/sales/enquiries'", "href: '/sales/follow-ups'", "p.startsWith('/sales/enquiries/')", 'onSales || open']) expect(sidebar).toContain(l);
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

  it('FMP-SALES-09: Confirmed chip, wonMonth filter, contract panel, no Add Follow-up button, single dropdown editor', () => {
    const ui = read('../_components/sales-ui.tsx');
    expect(ui).toContain("{ value: 'WON', label: STATUS_LABELS.WON }");
    expect(read('../_components/recent-enquiries.tsx')).toContain("{ value: 'WON', label: STATUS_LABELS.WON }");
    const list = read('../enquiries/page.tsx');
    expect(list).toContain(String.raw`/^\d{4}-(0[1-9]|1[0-2])$/.test(one(sp['wonMonth']))`);
    expect(list).toContain("qs.set('wonMonth', wonMonth)");
    expect(read('../page.tsx')).toContain('status=WON&wonMonth=');
    const actions = read('../_components/enquiry-actions.tsx') + read('../enquiries/[id]/page.tsx');
    expect(actions).not.toContain('Add Follow-up');
    expect(actions).toContain('Set Next Follow-up');
    const panel = read('../_components/enquiry-contract-panel.tsx');
    for (const l of ['Create Contract', 'Link Existing Contract', 'Open Contract', 'fromEnquiry=', 'canCreateContract', 'canReadContracts']) expect(panel).toContain(l);
    expect(panel).not.toMatch(/create.*automatically/i);
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

  it('Sales appears in the sidebar only as the sales.read-gated Sales Activities group with its three submenu links, and there is no export route', () => {
    const sidebar = fs.readFileSync(path.resolve(__dirname, '../../_components/sidebar.tsx'), 'utf8');
    expect(sidebar).toContain("permissions.includes('sales.read')");
    expect(sidebar).toContain('SALES_SUBMENU');
    expect(sidebar.match(/<SalesNavGroup /g)?.length).toBeGreaterThanOrEqual(2);
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
    expect(names).toEqual(['companyName', 'contactPerson', 'contactNumber', 'scopeOfWork', 'estimatedValue', 'nextFollowUpDate', 'followUpTask', 'remarks']);
  });

  it('the dashboard and register open the popup instead of linking to a separate page', () => {
    expect(read('../layout.tsx')).toContain('<NewEnquiryButton');
    expect(read('../page.tsx')).not.toContain('/sales/enquiries/new');
    expect(read('../enquiries/page.tsx')).toContain('<NewEnquiryButton');
    expect(read('../enquiries/page.tsx')).not.toContain('/sales/enquiries/new');
  });
});

describe('FMP-SALES-11 confirmation and Monthly Results', () => {
  it('the dashboard no longer shows Conversion This Month or Confirmed Projects; missing estimates stay distinct from zero', () => {
    const page = read('../page.tsx');
    expect(page).not.toContain('Conversion This Month');
    expect(page).not.toContain('Confirmed Projects');
    expect(page).toContain('data-missing-estimates');
    expect(page).toContain("d.confirmedMonth.withEstimate > 0 ? compactKwd(d.confirmedMonth.estimatedValue) : null");
    expect(page).toContain('/contracts?fromEnquiryMonth=');
    expect(page).toContain('/sales/enquiries?status=WON&wonMonth=');
  });

  it('Save Confirmation is the green button and the Confirmation Date defaults to Kuwait today and cannot be in the future', () => {
    const c = read('../_components/enquiry-status-control.tsx');
    expect(c).toContain("choice === 'WON' ? BTN_DONE : BTN_STATUS");
    expect(c).toContain('useState(today)');
    expect(c).toContain('max={today}');
    expect(c).toContain('wonDate > today');
    expect(c).not.toContain('Confirmed value (KWD)');
  });

  it('no month pattern has lost its backslash (a dropped digit-class backslash once made every month filter silently fail)', () => {
    for (const f of ['../enquiries/page.tsx', '../enquiries/[id]/page.tsx', '../../contracts/page.tsx', '../../../../../../api/src/contracts/dto/contract-list-query.dto.ts']) {
      const src = read(f);
      expect(src, f).not.toContain('/^d{4}');
    }
  });

  it('Create Contract sends an explicit enquiry reference with the creation request (validated and recorded atomically by the server); no timing heuristic and no separate link call remain', () => {
    const create = fs.readFileSync(path.resolve(__dirname, '../../contracts/actions.ts'), 'utf8');
    expect(create).toContain('...(fromEnquiryId !== undefined ? { fromEnquiryId } : {})');
    expect(create).not.toContain('createdFromEnquiry');
    expect(create).not.toContain('/contract`'); // the old second request that linked after creation
    expect(read('../actions.ts')).not.toContain('createdFromEnquiry');
    const svc = fs.readFileSync(path.resolve(__dirname, '../../../../../../api/src/sales/sales.service.ts'), 'utf8');
    expect(svc).not.toContain('CREATE_LINK_WINDOW');
    expect(svc).not.toContain('createdFromEnquiry');
  });

  it('the Change Status menu and popup are keyboard operable: arrow keys, Escape and focus returned to the button', () => {
    const c = read('../_components/enquiry-status-control.tsx');
    for (const k of ["'ArrowDown'", "'ArrowUp'", "'Home'", "'End'", "trigger.current?.focus()", 'autoFocus']) expect(c).toContain(k);
  });

  it('dashboard amounts: exact below one million, in words above, a recorded zero stays 0 and a blank stays blank', () => {
    expect(compactKwd('52000')).toEqual({ text: '52,000', number: '52,000', unit: '', exact: '52,000' });
    expect(compactKwd('999999.999')?.text).toBe('999,999.999');
    expect(compactKwd('12500000')).toMatchObject({ number: '12.5', unit: 'million', exact: '12,500,000' });
    expect(compactKwd('1123456839012.345')).toMatchObject({ number: '1,123.46', unit: 'billion' });
    expect(compactKwd('0')?.text).toBe('0');
    expect(compactKwd(null)).toBeNull();
    expect(compactKwd('')).toBeNull();
  });

  it('FMP-SALES-14: an amount shown in words opens its exact value by click and keyboard (not only hover); lists keep exact amounts', () => {
    const c = read('../_components/exact-amount.tsx');
    expect(c).toContain('<button');
    expect(c).toContain('aria-expanded={open}');
    expect(c).toContain("e.key === 'Escape'");
    expect(c).toContain('Exactly KWD');
    const page = read('../page.tsx');
    expect(page).toContain('<ExactAmount number={k.value}');
    expect(page).toContain('<ExactAmount number={confirmedValue.number}');
    expect(read('../enquiries/page.tsx')).toContain('formatKwd(e.estimatedValue)'); // the list still shows the exact amount
  });

  it('FMP-SALES-14: previews switch to the short card form whenever that shows more records (not only when none fits)', () => {
    const h = read('./use-fitted-count.ts');
    expect(h).toContain('const PREFERRED_RECORDS = 3;');
    expect(h).toContain('if (denseCount > n || n < 1) n = denseCount;');
    expect(read('../_components/follow-ups-panel.tsx')).toContain('sd-short-hide dense-hide');
  });

  it('short desktop windows (FMP-SALES-13): shorter dashboard presentation without hiding overflow, scaling or nested scrolling', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../globals.css'), 'utf8');
    const block = css.slice(css.indexOf('/* FMP-SALES-13')).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(block).toContain('@media (min-width: 1280px) and (max-height: 900px)');
    expect(block).not.toMatch(/transform|zoom|scale\(|overflow-y:\s*(auto|scroll)|font-size:\s*(0|1[0-5]px|0\.\d+rem)/);
    const page = read('../page.tsx');
    expect(page).toContain('sd-open-arrow'); // visible "opens a list" arrow on clickable cards
    expect(page).toContain('sd-month-link-text');
    const recent = read('../_components/recent-enquiries.tsx');
    expect(recent).toContain('sd-short-only'); // one "Show" filter on short windows
    expect(recent).toContain('View All Enquiries</Link>');
    expect(read('../_components/follow-ups-panel.tsx')).toContain('without follow-up');
  });

  it('the short-desktop layout uses real layout rules only (no CSS scaling or zoom) and leaves small screens to scroll', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../globals.css'), 'utf8');
    const block = css.slice(css.indexOf('/* FMP-SALES-12')).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(block).toContain('@media (min-width: 1280px) and (max-height: 1100px)'); // FMP-SALES-15: compact spacing up to 1100px tall
    expect(block).not.toMatch(/transform|zoom|scale\(/);
  });
});

describe('FMP-SALES-10 follow-up task list', () => {
  it('Add Activity asks "What needs to be done?" only when a follow-up is scheduled, and never reuses the activity note', () => {
    const a = read('../_components/add-activity-button.tsx');
    expect(a).toContain('What needs to be done?');
    expect(a).toContain('Follow-up Date');
    expect(a).toContain('followUpTask: task');
    expect(a).toContain('if (withFollowUp && !task.trim())');
    expect(a).not.toContain('followUpTask: notes');
    const act = read('../actions.ts');
    expect(act).toContain("body['followUpTask'] = task");
    expect(act).toContain('SALES_FOLLOW_UP_TASK_REQUIRED');
  });

  it('editing an enquiry never sends follow-up fields (no silent overwrite of a pending task)', () => {
    const act = read('../actions.ts');
    expect(act).toContain("delete body['nextFollowUpDate']");
    expect(act).toContain("delete body['followUpTask']");
    const form = read('../_components/enquiry-form.tsx');
    expect(form).toContain("mode === 'create' && (");
    expect(form).toContain('Follow-up tasks are added with');
  });

  it('the Follow-ups page lists tasks: filters with counts, Pending default, pagination, legacy fallback and the coloured buttons', () => {
    const p = read('../follow-ups/page.tsx');
    for (const label of ['Pending', 'Overdue', 'Due Today', 'Upcoming', 'Completed']) expect(p).toContain(`label: '${label}'`);
    expect(p).toContain("'PENDING'");
    expect(p).toContain('counts[f.key]');
    expect(p).toContain('pagination.totalPages');
    expect(p).toContain('TASK_NOT_RECORDED');
    expect(p).toContain('href={`/sales/enquiries/${f.enquiry.id}`}'); // each card opens its OWN enquiry
    expect(p).toContain('<FollowUpActions followUpId={f.id}');
    expect(p).not.toContain('GROUPS'); // the four large stacked sections are gone
    const actions = read('../_components/follow-up-actions.tsx');
    expect(actions).toContain('className={BTN_DONE}');
    expect(actions).toContain('className={BTN_STATUS}');
    expect(read('../_components/sales-ui.tsx')).toContain('export function OpenEnquiryLink');
  });

  it('older tasks without a description show "Follow-up details not recorded" and nothing is invented', () => {
    expect(TASK_NOT_RECORDED).toBe('Follow-up details not recorded');
    expect(taskText(null)).toBeNull();
    expect(taskText('   ')).toBeNull();
    expect(taskText(' Call the client ')).toBe('Call the client');
    for (const f of ['../follow-ups/page.tsx', '../_components/follow-ups-panel.tsx', '../enquiries/[id]/page.tsx']) expect(read(f)).toContain('TASK_NOT_RECORDED');
  });
});

describe('FMP-SALES-16 Enquiry Conversion in Monthly Results (current Kuwait month)', () => {
  const g = (received: number, confirmed: number, rate: number | null) => ({ period: '2026-11', received, confirmed, rate });

  it('shows the percentage and a plain sentence; "—" when nothing was received; 0% when none is confirmed', () => {
    expect(monthConversionText(g(2, 1, 50))).toEqual({ value: '50%', detail: '1 of 2 enquiries received this month confirmed' });
    expect(monthConversionText(g(3, 1, 33.3))).toEqual({ value: '33.3%', detail: '1 of 3 enquiries received this month confirmed' });
    expect(monthConversionText(g(4, 0, 0))).toEqual({ value: '0%', detail: '0 of 4 enquiries received this month confirmed' });
    expect(monthConversionText(g(1, 1, 100)).detail).toBe('1 of 1 enquiry received this month confirmed');
    expect(monthConversionText(g(0, 0, null))).toEqual({ value: '—', detail: 'No enquiries received this month' });
    expect(monthConversionText(undefined)).toEqual({ value: '—', detail: 'No enquiries received this month' });
  });

  it('is the fourth Monthly Results card, follows the heading month (no period dropdown or query parameter) and opens that received month', () => {
    const page = read('../page.tsx');
    const order = ['data-monthly-card="confirmed"', 'data-monthly-card="value"', 'data-monthly-card="contracts"', 'data-monthly-card="conversion"'].map((t) => page.indexOf(t));
    expect(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1]!))).toBe(true);
    expect(page).toContain('d.enquiryConversion.months.find((m) => m.period === d.month)');
    expect(page).toContain('href={`/sales/enquiries?month=${d.month}`}');
    expect(page).toContain('Estimated Confirmed Value — KWD');
    expect(page).toContain('xl:grid-cols-4');
    expect(page).not.toContain('EnquiryConversionCard');
    expect(page).not.toContain('<select');
    expect(fs.existsSync(path.resolve(__dirname, '../_components/enquiry-conversion-card.tsx'))).toBe(false);
  });

  it('very short windows get one-line labels by layout rules only (no scaling, nested scrolling or hidden overflow)', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../globals.css'), 'utf8');
    const block = css.slice(css.indexOf('/* FMP-SALES-15 — very short')).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(block).toContain('@media (min-width: 1280px) and (max-height: 640px)');
    expect(block).not.toMatch(/transform|zoom|scale\(|overflow-y:\s*(auto|scroll)/);
  });
});
