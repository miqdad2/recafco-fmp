import { describe, it, expect } from 'vitest';
import { canManageTechnical, canReadTechnical, canWriteTechnical } from './technical-permissions';

describe('Technical page permissions (FMP-ACCESS-02)', () => {
  it('read: technical.read, or the older contracts.read for Contract Managers', () => {
    expect(canReadTechnical(['technical.read'])).toBe(true);
    expect(canReadTechnical(['contracts.read'])).toBe(true);
    expect(canReadTechnical(['production.read'])).toBe(false);
  });

  it('write buttons stay hidden without technical.update (or the older contract workflow codes)', () => {
    expect(canWriteTechnical(['technical.read'])).toBe(false);
    expect(canWriteTechnical(['contracts.read'])).toBe(false);
    expect(canWriteTechnical(['technical.read', 'technical.update'])).toBe(true);
    expect(canWriteTechnical(['contracts.workflow_update'])).toBe(true);
    expect(canWriteTechnical(['contracts.update'])).toBe(true);
  });

  it('managing files uploaded by others needs technical.manage or the older contracts.manage', () => {
    expect(canManageTechnical(['technical.update'])).toBe(false);
    expect(canManageTechnical(['technical.manage'])).toBe(true);
    expect(canManageTechnical(['contracts.manage'])).toBe(true);
  });
});
