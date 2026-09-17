import { describe, it, expect } from 'vitest';
import { resolveErectionPreviewMode } from './erection-preview';

describe('resolveErectionPreviewMode', () => {
  it('is true for a manager-tier actor (contracts.update) with ?preview=1', () => {
    expect(resolveErectionPreviewMode(['contracts.read', 'contracts.update'], '1')).toBe(true);
  });

  it('is false for a manager-tier actor without the preview param', () => {
    expect(resolveErectionPreviewMode(['contracts.read', 'contracts.update'], undefined)).toBe(false);
  });

  it('is false for a manager-tier actor with a non-"1" preview value', () => {
    expect(resolveErectionPreviewMode(['contracts.read', 'contracts.update'], 'true')).toBe(false);
  });

  it('is false for a staff-tier actor (contracts.workflow_update only) even with ?preview=1 — real workflow gating is never weakened', () => {
    expect(resolveErectionPreviewMode(['contracts.read', 'contracts.workflow_update'], '1')).toBe(false);
  });

  it('is false for an actor with neither permission, regardless of the param', () => {
    expect(resolveErectionPreviewMode(['contracts.read'], '1')).toBe(false);
  });

  it('is false when the param is an array (never a single "1" string)', () => {
    expect(resolveErectionPreviewMode(['contracts.update'], ['1'])).toBe(false);
  });
});
