import { z } from 'zod';

export const NodeEnvSchema = z.enum(['development', 'production', 'test']);
export type NodeEnv = z.infer<typeof NodeEnvSchema>;

export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export class EnvironmentValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

export function parseEnvOrThrow<T>(schema: z.ZodSchema<T>, raw: unknown, label: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join('; ');
    throw new EnvironmentValidationError(label, `Invalid value for ${label}: ${issues}`);
  }
  return result.data;
}

export function parseEnvSafe<T>(
  schema: z.ZodSchema<T>,
  raw: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join('; ');
    return { success: false, error: issues };
  }
  return { success: true, data: result.data };
}
