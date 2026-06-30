import { describe, it, expect } from 'vitest';
import { resolveRequestId } from './request-id.middleware';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('returns the incoming ID when valid', () => {
    expect(resolveRequestId('abc-123')).toBe('abc-123');
  });

  it('accepts underscores and hyphens', () => {
    expect(resolveRequestId('req_abc-def')).toBe('req_abc-def');
  });

  it('generates a UUID when incoming is undefined', () => {
    const id = resolveRequestId(undefined);
    expect(UUID_PATTERN.test(id)).toBe(true);
  });

  it('generates a UUID when incoming is empty string', () => {
    const id = resolveRequestId('');
    expect(UUID_PATTERN.test(id)).toBe(true);
  });

  it('generates a UUID when incoming exceeds 64 characters', () => {
    const long = 'a'.repeat(65);
    const id = resolveRequestId(long);
    expect(UUID_PATTERN.test(id)).toBe(true);
  });

  it('generates a UUID when incoming contains forbidden characters', () => {
    const id = resolveRequestId('req id with spaces');
    expect(UUID_PATTERN.test(id)).toBe(true);
  });

  it('accepts exactly 64 characters', () => {
    const exact = 'a'.repeat(64);
    expect(resolveRequestId(exact)).toBe(exact);
  });

  it('generates different UUIDs on successive calls', () => {
    const a = resolveRequestId(undefined);
    const b = resolveRequestId(undefined);
    expect(a).not.toBe(b);
  });
});
