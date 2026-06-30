import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  NodeEnvSchema,
  LogLevelSchema,
  EnvironmentValidationError,
  parseEnvOrThrow,
  parseEnvSafe,
} from './shared';

describe('NodeEnvSchema', () => {
  it('accepts valid values', () => {
    expect(NodeEnvSchema.parse('development')).toBe('development');
    expect(NodeEnvSchema.parse('production')).toBe('production');
    expect(NodeEnvSchema.parse('test')).toBe('test');
  });

  it('rejects invalid values', () => {
    expect(() => NodeEnvSchema.parse('staging')).toThrow();
  });
});

describe('LogLevelSchema', () => {
  it('accepts all valid log levels', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
      expect(LogLevelSchema.parse(level)).toBe(level);
    }
  });

  it('rejects invalid log levels', () => {
    expect(() => LogLevelSchema.parse('verbose')).toThrow();
  });
});

describe('EnvironmentValidationError', () => {
  it('carries field name and message', () => {
    const err = new EnvironmentValidationError('MY_VAR', 'Invalid value for MY_VAR: bad input');
    expect(err.field).toBe('MY_VAR');
    expect(err.message).toBe('Invalid value for MY_VAR: bad input');
    expect(err.name).toBe('EnvironmentValidationError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('parseEnvOrThrow', () => {
  const schema = z.string().min(1);

  it('returns parsed value on success', () => {
    expect(parseEnvOrThrow(schema, 'hello', 'TEST_VAR')).toBe('hello');
  });

  it('throws EnvironmentValidationError on failure', () => {
    expect(() => parseEnvOrThrow(schema, '', 'TEST_VAR')).toThrow(EnvironmentValidationError);
  });

  it('includes the field name in the thrown error', () => {
    try {
      parseEnvOrThrow(schema, '', 'MY_SECRET_VAR');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvironmentValidationError);
      expect((err as EnvironmentValidationError).field).toBe('MY_SECRET_VAR');
    }
  });
});

describe('parseEnvSafe', () => {
  const schema = z.number().positive();

  it('returns success result for valid input', () => {
    const result = parseEnvSafe(schema, 42);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it('returns failure result for invalid input', () => {
    const result = parseEnvSafe(schema, -1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeTruthy();
  });
});
