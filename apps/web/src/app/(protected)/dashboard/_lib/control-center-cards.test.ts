import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { PlatformModuleCard, PlatformModuleCode } from '@/lib/platform-api';
import { selectControlCenterCards, CONTROL_CENTER_API_CARDS, CARD_CTA } from './control-center-cards';

const ALL: PlatformModuleCode[] = [
  'CONTRACTS_MANAGEMENT', 'ESTIMATION', 'TECHNICAL', 'ERECTION', 'QA_QC', 'STORAGE_DELIVERY',
  'SAFETY_COMPLIANCE', 'INCIDENT_REPORT', 'PRODUCTION_DASHBOARD', 'MAINTENANCE_REQUESTS', 'FACTORY_TASKS',
];
const card = (code: PlatformModuleCode): PlatformModuleCard => ({ code, title: `api-${code}`, description: 'x', route: `/r/${code}`, metrics: [] });
const read = (p: string): string => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('Control Center cards (FMP-UI-36)', () => {
  it('keeps only the five retained API cards, in the approved order, with the approved titles', () => {
    const out = selectControlCenterCards([...ALL].reverse().map(card));
    expect(out.map((c) => c.displayTitle)).toEqual(['Contract Management', 'Technical', 'Production & Planning', 'Delivery', 'Erection']);
  });

  it('drops the removed modules', () => {
    const codes = selectControlCenterCards(ALL.map(card)).map((c) => c.code);
    for (const gone of ['ESTIMATION', 'SAFETY_COMPLIANCE', 'INCIDENT_REPORT', 'MAINTENANCE_REQUESTS', 'FACTORY_TASKS', 'QA_QC'] as const) expect(codes).not.toContain(gone);
  });

  it('never adds a card the API did not return (permission gating stays with the API)', () => {
    expect(selectControlCenterCards([card('TECHNICAL')]).map((c) => c.code)).toEqual(['TECHNICAL']);
    expect(selectControlCenterCards([])).toEqual([]);
  });

  it('keeps the API route; Delivery still points at the Storage Yard & Delivery route', () => {
    const out = selectControlCenterCards([card('STORAGE_DELIVERY')]);
    expect(out[0]!.route).toBe('/r/STORAGE_DELIVERY');
    expect(out[0]!.displayTitle).toBe('Delivery');
  });

  it('descriptions match the approved wording', () => {
    expect(CONTROL_CENTER_API_CARDS.map((c) => c.description)).toEqual([
      'Contracts, payments and project progress.',
      'Drawings, confirmed elements and production releases.',
      'Production readiness, active work and completed elements.',
      'Storage, dispatch and delivery progress.',
      'Site erection activities and completed elements.',
    ]);
  });

  it('page renders the cards in order; Factory Performance keeps its external URL; Sales card is always the seventh card: /sales for sales.read, otherwise Access Restricted with no link', () => {
    const page = read('../page.tsx');
    expect(page.indexOf('cards.map')).toBeLessThan(page.indexOf('FACTORY_PERFORMANCE_CARD.title'));
    expect(page.indexOf('FACTORY_PERFORMANCE_CARD.title')).toBeLessThan(page.indexOf('SALES_ENQUIRIES_CARD.title'));
    expect(page).toContain("'http://192.168.1.17:83'");
    expect(page).toContain("href=\"/sales\"");
    expect(page).toContain("hasSales ? (");
    expect(page).toContain("Access Restricted");
    expect(page).toContain("permissions.includes('sales.read')");
  });

  it('responsive grid: 1 / 2 / 3 / 4 columns, no narrow centered container', () => {
    const page = read('../page.tsx');
    expect(page).toContain('grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4');
    expect(page).not.toContain('max-w-7xl');
  });

  it('card shows "Not available" for null metrics and renders no button when it is not a link', () => {
    const src = read('../_components/control-center-card.tsx');
    expect(src).toContain("'Not available'");
    expect(src).toContain('{interactive ? (');
  });

  it('module-specific button labels; no card says Open Dashboard; Sales card is gated by sales.read', () => {
    expect(CARD_CTA).toEqual({
      CONTRACTS_MANAGEMENT: 'Open Contract Management',
      TECHNICAL: 'Open Technical',
      PRODUCTION_DASHBOARD: 'Open Production',
      STORAGE_DELIVERY: 'Open Delivery',
      ERECTION: 'Open Erection',
      FACTORY_PERFORMANCE: 'Open Factory Performance',
      SALES_ENQUIRIES: 'Open Sales & Enquiries',
    });
    expect(read('../_components/control-center-card.tsx')).not.toContain('Open Dashboard');
    expect(read('../_components/control-center-card.tsx')).not.toContain('truncate');
    const page = read("../page.tsx");
    expect(page).toContain("cta={CARD_CTA.SALES_ENQUIRIES}");
  });

  it('metric wording is display-only: values, order and unknown labels pass through', () => {
    const c: PlatformModuleCard = { ...card('CONTRACTS_MANAGEMENT'), metrics: [{ label: 'Total', value: 4 }, { label: 'Active', value: null }, { label: 'Other', value: 1 }] };
    const out = selectControlCenterCards([c])[0]!.metrics;
    expect(out).toEqual([{ label: 'Total Contracts', value: 4 }, { label: 'Active Contracts', value: null }, { label: 'Other', value: 1 }]);
  });
});

describe('Sales card access (FMP-SALES-01A)', () => {
  const page = read('../page.tsx');
  const restricted = page.slice(page.indexOf(') : ('));

  it('the Sales figures are only fetched for sales.read', () => {
    expect(page).toContain("const salesRes = hasSales ? await salesApi.dashboard() : null;");
  });

  it('the restricted card has no link, no figures, no button and never says Setup Pending', () => {
    expect(restricted).not.toContain('href=');
    expect(restricted).not.toContain('metrics=');
    expect(restricted).not.toContain('cta=');
    expect(restricted).not.toContain('Setup Pending');
    expect(restricted).toContain('badge="Access Restricted"');
    expect(restricted).toContain('footer="Access Restricted"');
  });

  it('there is no hard-coded role-based grant: visibility is the sales.read permission only', () => {
    expect(page).toContain("permissions.includes('sales.read')");
    expect(page).not.toMatch(/EXECUTIVE_MANAGER|isExecutiveManager|fullPlatformAccess.*sales/);
  });
});
