import { z } from 'zod';
import { NodeEnvSchema } from './shared';

export const WebEnvSchema = z
  .object({
    NODE_ENV: NodeEnvSchema.default('development'),
    API_BASE_URL: z.string().url().optional(),
  })
  .transform((raw) => ({
    nodeEnv: raw.NODE_ENV,
    apiBaseUrl: raw.API_BASE_URL ?? 'http://localhost:4000',
  }));

export type WebEnv = z.infer<typeof WebEnvSchema>;
