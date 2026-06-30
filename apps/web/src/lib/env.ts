import { WebEnvSchema } from '@recafco/config';
import type { WebEnv } from '@recafco/config';

export function getWebEnv(): WebEnv | null {
  const result = WebEnvSchema.safeParse({
    NODE_ENV: process.env['NODE_ENV'],
    API_BASE_URL: process.env['API_BASE_URL'],
  });
  if (!result.success) return null;
  return result.data;
}
