import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ATTENTION_EMPTY_MESSAGE,
  attentionTone,
  DOCUMENTS_EMPTY_MESSAGE,
  isAllProgressZero,
  isDocumentsSummaryEmpty,
  isPaymentStatementEmpty,
  isProductionSummaryEmpty,
  MANAGER_ONLY_WORDING,
  OVERVIEW_SECTION_TITLES,
  PAYMENT_EMPTY_MESSAGE,
  PRODUCTION_EMPTY_MESSAGE,
  PROGRESS_EMPTY_MESSAGE,
  scheduleBadgeClass,
  attentionTitle,
  productionStatusMessage,
  CONTRACT_SUMMARY_LAYOUT,
} from './contract-overview-display-helpers';
import { paymentTermDetailText } from './payment-terms-helpers';
import { canEditBasicDetails } from './contract-basic-details-helpers';
import { getVisibleContractTransitions, getClosureAction } from './contract-ui-helpers';

const ZERO_PAYMENTS = { totalInvoices: 0, totalSubmitted: '0', totalPaid: '0.000', totalOutstanding: '0', overdueValue: '0' };
const ZERO_PRODUCTION = { total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0 };

describe('Contract Overview display helpers (FMP-CONTRACT-07)', () => {
  it('Attention card is a warning only when there are attention items; otherwise neutral with the friendly message', () => {
    expect(attentionTone(0)).toBe('neutral');
    expect(attentionTone(1)).toBe('warning');
    expect(attentionTone(4)).toBe('warning');
    expect(ATTENTION_EMPTY_MESSAGE).toBe('No open items require attention.');
  });

  it('payment statement all-zero state is detected; any real amount or invoice keeps the table', () => {
    expect(isPaymentStatementEmpty(ZERO_PAYMENTS)).toBe(true);
    expect(PAYMENT_EMPTY_MESSAGE).toBe('No payment entries yet.');
    expect(isPaymentStatementEmpty({ ...ZERO_PAYMENTS, totalInvoices: 1 })).toBe(false);
    expect(isPaymentStatementEmpty({ ...ZERO_PAYMENTS, totalPaid: '250.000' })).toBe(false);
  });

  it('production summary all-zero state is detected; any task keeps the table', () => {
    expect(isProductionSummaryEmpty(ZERO_PRODUCTION)).toBe(true);
    expect(PRODUCTION_EMPTY_MESSAGE).toBe('Production has not started yet.');
    expect(isProductionSummaryEmpty({ ...ZERO_PRODUCTION, total: 3, pending: 3 })).toBe(false);
  });

  it('documents all-zero state is detected; attachments keep the table', () => {
    expect(isDocumentsSummaryEmpty(0)).toBe(true);
    expect(DOCUMENTS_EMPTY_MESSAGE).toBe('No attachments or pending obligations.');
    expect(isDocumentsSummaryEmpty(2)).toBe(false);
  });

  it('progress helper shows only when every ring is 0', () => {
    expect(isAllProgressZero([0, 0, 0, 0])).toBe(true);
    expect(isAllProgressZero([0, 40, 0, 10])).toBe(false);
    expect(PROGRESS_EMPTY_MESSAGE).toBe('No progress recorded yet.');
  });

  it('payment terms with no saved percentage read "Not specified" (never "Percentage not set")', () => {
    const terms = { advance: true, retention: true, performanceBond: true, insurance: true };
    for (const key of ['advance', 'retention', 'performanceBond', 'insurance']) {
      expect(paymentTermDetailText(key, terms, undefined)).toBe('Not specified');
    }
    expect(paymentTermDetailText('advance', terms, { advance: { percentage: 10 } })).toBe('10%');
    expect(paymentTermDetailText('retention', terms, { retention: { percentage: 5 } })).toBe('5%');
  });

  it('Schedule Status badge: Delayed warns, Completed is positive, anything else is a defined tone', () => {
    expect(scheduleBadgeClass('DELAYED')).toContain('warning');
    expect(scheduleBadgeClass('COMPLETED')).toContain('success');
    expect(scheduleBadgeClass('ON_TRACK')).toContain('success');
    expect(scheduleBadgeClass('UNKNOWN')).toContain('surface-secondary');
  });

  it('action buttons still follow the existing permissions (Edit separate from the destructive group)', () => {
    expect(canEditBasicDetails('ACTIVE', ['contracts.read'])).toBe(false);
    expect(canEditBasicDetails('ACTIVE', ['contracts.read', 'contracts.update'])).toBe(true);
    const full = ['contracts.read', 'contracts.update', 'contracts.activate', 'contracts.terminate', 'contracts.close'];
    const visible = getVisibleContractTransitions('ACTIVE', full);
    expect(visible.terminate).toBe(true);
    expect(getClosureAction('ACTIVE', full, null).showRequestCloseout).toBe(true);
    const viewer = getVisibleContractTransitions('ACTIVE', ['contracts.read']);
    expect(viewer.terminate).toBe(false);
    expect(viewer.cancel).toBe(false);
  });

  it('role-neutral wording: the section titles are the agreed set and no component frames the page as management-only', () => {
    expect(OVERVIEW_SECTION_TITLES).toContain('Production Summary');
    expect(OVERVIEW_SECTION_TITLES).toContain('Documents & Obligations');
    const dir = path.resolve(__dirname, '../_components');
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('contract-overview-') && f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(0);
    const pageFile = path.resolve(__dirname, '../[id]/(workspace)/page.tsx');
    const sources = [...files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')), fs.readFileSync(pageFile, 'utf8')];
    for (const src of sources) {
      for (const phrase of MANAGER_ONLY_WORDING) {
        expect(src.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });
});

describe('Contract Overview final polish (FMP-CONTRACT-08)', () => {
  it('Contract Summary layout: key facts, then key status, then secondary details — every field exactly once', () => {
    const labels = (rows: { label: string }[]): string[] => rows.map((r) => r.label);
    expect(labels(CONTRACT_SUMMARY_LAYOUT.keyFacts)).toEqual(['Project Name', 'Company Name', 'Job Order']);
    expect(labels(CONTRACT_SUMMARY_LAYOUT.keyStatus)).toEqual(['Contract Status', 'Days Remaining', 'Current Contract Value']);
    expect(labels(CONTRACT_SUMMARY_LAYOUT.secondary)).toEqual(['Date', 'Quotation #', 'Project Number', 'Contract Manager', 'Schedule Status']);
    const all = [...CONTRACT_SUMMARY_LAYOUT.keyFacts, ...CONTRACT_SUMMARY_LAYOUT.keyStatus, ...CONTRACT_SUMMARY_LAYOUT.secondary];
    expect(new Set(all.map((f) => f.key)).size).toBe(all.length);
  });

  it('attention title: "Attention Required" only with open items, otherwise "No Attention Required"', () => {
    expect(attentionTitle(0)).toBe('No Attention Required');
    expect(attentionTitle(1)).toBe('Attention Required');
    expect(attentionTitle(5)).toBe('Attention Required');
  });

  it('production message matches the task state', () => {
    const base = { total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0 };
    expect(productionStatusMessage(base)).toBe('Production has not started yet.');
    expect(productionStatusMessage({ ...base, total: 4, pending: 4 })).toBe('Production tasks are pending.');
    expect(productionStatusMessage({ ...base, total: 4, pending: 3, inProgress: 1 })).toBe('Production is in progress.');
    expect(productionStatusMessage({ ...base, total: 4, pending: 2, completed: 2 })).toBe('Production activity has started.');
    expect(productionStatusMessage({ ...base, total: 4, completed: 4 })).toBe('Production tasks completed.');
  });
});
