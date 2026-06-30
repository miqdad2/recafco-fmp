// Prisma 7 configuration file.
// Loaded by the Prisma CLI only — not compiled by tsc (excluded in tsconfig.json).
// DATABASE_URL is loaded from .env via dotenv before Prisma reads it.

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasourceUrl: process.env['DATABASE_URL'],
});
