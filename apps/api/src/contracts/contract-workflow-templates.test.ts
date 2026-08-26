import { describe, it, expect } from 'vitest';
import {
  shouldIncludeTechnical,
  shouldIncludeProduction,
  shouldIncludeErection,
  shouldIncludeQsCommercial,
  generateWorkflowTaskTemplates,
} from './contract-workflow-templates';

describe('shouldIncludeTechnical', () => {
  it('includes when shopDrawing is selected', () => {
    expect(shouldIncludeTechnical({ shopDrawing: true })).toBe(true);
  });
  it('includes when designProduction (Production Drawings) is selected', () => {
    expect(shouldIncludeTechnical({ designProduction: true })).toBe(true);
  });
  it('excludes when neither is selected', () => {
    expect(shouldIncludeTechnical({ production: true })).toBe(false);
  });
  it('excludes when scope is null/undefined', () => {
    expect(shouldIncludeTechnical(null)).toBe(false);
    expect(shouldIncludeTechnical(undefined)).toBe(false);
  });
  it('excludes when notApplicable is selected even if shopDrawing is also true', () => {
    expect(shouldIncludeTechnical({ shopDrawing: true, notApplicable: true })).toBe(false);
  });
});

describe('shouldIncludeProduction', () => {
  it('includes when production is selected', () => {
    expect(shouldIncludeProduction({ production: true })).toBe(true);
  });
  it('excludes when production is not selected', () => {
    expect(shouldIncludeProduction({ shopDrawing: true })).toBe(false);
  });
});

describe('shouldIncludeErection', () => {
  it('includes when delivery is selected', () => {
    expect(shouldIncludeErection({ delivery: true })).toBe(true);
  });
  it('includes when erection is selected', () => {
    expect(shouldIncludeErection({ erection: true })).toBe(true);
  });
  it('excludes when Ex-Factory is selected, even if erection/delivery are also true', () => {
    expect(shouldIncludeErection({ exFactory: true, erection: true })).toBe(false);
    expect(shouldIncludeErection({ exFactory: true, delivery: true })).toBe(false);
  });
  it('excludes when neither delivery nor erection is selected', () => {
    expect(shouldIncludeErection({ production: true })).toBe(false);
  });
});

describe('shouldIncludeQsCommercial', () => {
  it('includes when payment terms are set', () => {
    expect(shouldIncludeQsCommercial({}, true, false)).toBe(true);
  });
  it('includes when a contract value is set', () => {
    expect(shouldIncludeQsCommercial({}, false, true)).toBe(true);
  });
  it('excludes when neither payment terms nor contract value is set', () => {
    expect(shouldIncludeQsCommercial({}, false, false)).toBe(false);
  });
  it('excludes when notApplicable is selected, even with a contract value', () => {
    expect(shouldIncludeQsCommercial({ notApplicable: true }, true, true)).toBe(false);
  });
});

describe('generateWorkflowTaskTemplates', () => {
  it('generates Technical + Production tasks for Shop Drawing + Production scope (Scenario B)', () => {
    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: { shopDrawing: true, production: true },
      paymentTerms: null,
      contractValue: null,
    });
    const teams = new Set(templates.map((t) => t.team));
    expect(teams.has('TECHNICAL')).toBe(true);
    expect(teams.has('PRODUCTION')).toBe(true);
    expect(teams.has('ERECTION')).toBe(false);
    expect(teams.has('QS_COMMERCIAL')).toBe(false);
    expect(templates.some((t) => t.taskName === 'Drawing Received')).toBe(true);
    expect(templates.some((t) => t.taskName === 'Submission of Mix Design')).toBe(true);
  });

  it('does not generate Delivery/Erection tasks for an Ex-Factory contract (Scenario C)', () => {
    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: { exFactory: true, delivery: true, erection: true },
      paymentTerms: null,
      contractValue: null,
    });
    expect(templates.some((t) => t.team === 'ERECTION')).toBe(false);
  });

  it('generates nothing at all when notApplicable is selected, even with a contract value', () => {
    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: { notApplicable: true },
      paymentTerms: { advance: true },
      contractValue: 5000,
    });
    expect(templates).toHaveLength(0);
  });

  it('generates nothing for an old contract with no scope, no payment terms, and no contract value (Scenario G)', () => {
    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: null,
      paymentTerms: null,
      contractValue: null,
    });
    expect(templates).toHaveLength(0);
  });

  it('generates only QS/Commercial when a contract has a value but no operational scope', () => {
    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: null,
      paymentTerms: null,
      contractValue: 1000,
    });
    expect(templates).toHaveLength(1);
    expect(templates[0]?.team).toBe('QS_COMMERCIAL');
    expect(templates[0]?.taskName).toBe('Payment Issued');
  });

  it('generates every team for a full-scope contract with a contract value', () => {
    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: { shopDrawing: true, production: true, erection: true },
      paymentTerms: null,
      contractValue: 5000,
    });
    const teams = new Set(templates.map((t) => t.team));
    expect(teams).toEqual(new Set(['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL']));
    // Technical(4) + Production(5) + Erection(6) + QS(1) = 16
    expect(templates).toHaveLength(16);
  });

  it('produces stable, unique taskKeys within a single generation', () => {
    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: { shopDrawing: true, production: true, erection: true },
      paymentTerms: { advance: true },
      contractValue: null,
    });
    const keys = templates.map((t) => t.taskKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
