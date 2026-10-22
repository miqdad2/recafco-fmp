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
    const page = read('../page.tsx');
    for (const l of ['Enquiries This Month', 'Follow-ups Due', 'Active Enquiries', 'Estimated Project Value', 'Confirmed Projects', 'Conversion This Month']) expect(page).toContain(l);
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

  it('Sales is not added to the main sidebar, and there is no export route', () => {
    const sidebar = fs.readFileSync(path.resolve(__dirname, '../../_components/sidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/\/sales/);
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
    expect(read('../page.tsx')).toContain('<NewEnquiryButton');
    expect(read('../page.tsx')).not.toContain('/sales/enquiries/new');
    expect(read('../enquiries/page.tsx')).toContain('<NewEnquiryButton');
    expect(read('../enquiries/page.tsx')).not.toContain('/sales/enquiries/new');
  });
});
