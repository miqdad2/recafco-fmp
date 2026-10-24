import { describe, it, expect } from 'vitest';
import { evaluateProjectMatches, nameSimilarity, normalizeFactoryCode, normalizeJobOrder, type MatchContract, type MatchProject } from '@recafco/shared';

const project = (over: Partial<MatchProject> = {}): MatchProject => ({
  sourceProjectId: 'shapoorji-2025-92',
  jobOrderNormalized: '92/25',
  factoryCode: 'PC',
  sourceName: 'Shapoorji · New Sabah Hospital',
  contractId: null,
  ...over,
});

const contract = (over: Partial<MatchContract> = {}): MatchContract => ({
  id: 'c1',
  referenceNumber: 'CONTRACT-2026-000100',
  title: '[TEST] New Al Sabah Hospital',
  counterpartyName: 'Shapoorji',
  jobOrder: '92/25',
  status: 'ACTIVE',
  factoryCode: 'PC',
  linkedSourceProjectId: null,
  ...over,
});

describe('normalizeJobOrder', () => {
  it.each([
    ['92/25', '92/25'],
    [' 92 / 25 ', '92/25'],
    ['092/25', '92/25'],
    ['92-25', '92/25'],
    ['92\\25', '92/25'],
    ['JO-0092/25', '92/25'],
    ['jo 92/25', '92/25'],
    ['JO0092/25', '92/25'],
    ['PC-92/25', 'PC/92/25'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeJobOrder(raw)).toBe(expected);
  });
  it('returns null for empty input', () => {
    expect(normalizeJobOrder(null)).toBeNull();
    expect(normalizeJobOrder('  ')).toBeNull();
    expect(normalizeJobOrder('/')).toBeNull();
  });
  it('does not strip letters that merely start with JO', () => {
    expect(normalizeJobOrder('JOHN/1')).toBe('JOHN/1');
  });
  it('normalizes factory codes', () => {
    expect(normalizeFactoryCode(' pc ')).toBe('PC');
    expect(normalizeFactoryCode('')).toBeNull();
  });
});

describe('evaluateProjectMatches', () => {
  it('marks an already linked project as LINKED', () => {
    expect(evaluateProjectMatches(project({ contractId: 'c1' }), [contract()]).state).toBe('LINKED');
  });

  it('auto-links a unique job order + factory match', () => {
    const r = evaluateProjectMatches(project(), [contract(), contract({ id: 'c2', jobOrder: '10/26', title: 'Other' })]);
    expect(r.state).toBe('AUTO_LINKABLE');
    expect(r.autoLinkContractId).toBe('c1');
    expect(r.candidates[0]?.reasons.join(' ')).toMatch(/Job order 92\/25 matches/);
    expect(r.candidates[0]?.reasons.join(' ')).toMatch(/Factory PC matches/);
  });

  it('matches across formatting differences', () => {
    const r = evaluateProjectMatches(project(), [contract({ jobOrder: 'JO-0092/25' })]);
    expect(r.state).toBe('AUTO_LINKABLE');
  });

  it('never matches the same number in a different factory (PC vs HC)', () => {
    const r = evaluateProjectMatches(project({ factoryCode: 'HC' }), [contract({ factoryCode: 'PC' })]);
    expect(r.state).toBe('AWAITING');
    expect(r.candidates).toHaveLength(0);
  });

  it('only SUGGESTS when the contract factory is unknown (no plant mapping)', () => {
    const r = evaluateProjectMatches(project(), [contract({ factoryCode: null })]);
    expect(r.state).toBe('SUGGESTED');
    expect(r.autoLinkContractId).toBeNull();
    expect(r.candidates[0]?.blockers.join(' ')).toMatch(/no plant mapped/);
  });

  it('only SUGGESTS when the source has not reported a factory', () => {
    const r = evaluateProjectMatches(project({ factoryCode: null }), [contract()]);
    expect(r.state).toBe('SUGGESTED');
  });

  it('is a CONFLICT when two contracts share the job order and factory', () => {
    const r = evaluateProjectMatches(project(), [contract(), contract({ id: 'c2' })]);
    expect(r.state).toBe('CONFLICT');
    expect(r.autoLinkContractId).toBeNull();
  });

  it('is a CONFLICT when a second contract has the job order but no factory (not unique)', () => {
    const r = evaluateProjectMatches(project(), [contract(), contract({ id: 'c2', factoryCode: null })]);
    expect(r.state).toBe('CONFLICT');
  });

  it('is a CONFLICT when the contract is already linked to another source project', () => {
    const r = evaluateProjectMatches(project(), [contract({ linkedSourceProjectId: 'other-project' })]);
    expect(r.state).toBe('CONFLICT');
    expect(r.candidates[0]?.blockers.join(' ')).toMatch(/already linked/);
  });

  it('is a CONFLICT when another registered source project has the same identity', () => {
    expect(evaluateProjectMatches(project(), [contract()], 1).state).toBe('CONFLICT');
  });

  it('never auto-links on a project name alone', () => {
    const r = evaluateProjectMatches(project({ jobOrderNormalized: '99/25' }), [contract({ jobOrder: null })]);
    expect(r.autoLinkContractId).toBeNull();
    expect(r.state).toBe('SUGGESTED');
    expect(r.candidates[0]?.reasons.join(' ')).toMatch(/name is similar/);
  });

  it('does not suggest on a single shared word', () => {
    const r = evaluateProjectMatches(project({ jobOrderNormalized: null, sourceName: 'Hospital Annex' }), [
      contract({ jobOrder: null, title: 'Mubarak Hospital' }),
    ]);
    expect(r.candidates).toHaveLength(0);
    expect(r.state).toBe('AWAITING');
  });

  it('ignores cancelled contracts', () => {
    expect(evaluateProjectMatches(project(), [contract({ status: 'CANCELLED' })]).state).toBe('AWAITING');
  });

  it('waits when the source identity is not known yet', () => {
    const r = evaluateProjectMatches(project({ jobOrderNormalized: null, factoryCode: null, sourceName: null }), [contract()]);
    expect(r.state).toBe('AWAITING');
    expect(r.summary).toMatch(/Waiting for the source/);
  });
});

describe('nameSimilarity', () => {
  it('compares significant words only', () => {
    expect(nameSimilarity('New Al Sabah Hospital', '[TEST] New Al Sabah Hospital')).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity('the and for', 'the and for')).toBe(0);
    expect(nameSimilarity(null, 'x')).toBe(0);
  });
});
