// Prisma 7 configuration file.
// Loaded by the Prisma CLI only — not compiled by tsc (excluded in tsconfig.json).
// DATABASE_URL is loaded from .env via dotenv before Prisma reads it.

import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));

config({
  path: path.resolve(packageDirectory, "../../.env"),
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});