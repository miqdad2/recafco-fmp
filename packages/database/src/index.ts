export { createPrismaClient } from './prisma-client';
export type { DatabaseClientConfig } from './prisma-client';

export { checkDatabaseHealth } from './database-health';
export type { DatabaseHealthResult, DatabaseHealthOk, DatabaseHealthUnavailable } from './database-health';

export type { PrismaClient, Department, Plant, Location } from './generated/prisma/client';
export { Prisma } from './generated/prisma/client';
