/**
 * bootstrap-admin.ts
 *
 * Creates the first administrator account when no users exist.
 * Run with: pnpm --filter @recafco/api bootstrap:admin
 *
 * The password is entered interactively (not echoed, not stored in env or .env).
 * This script exits with code 1 if any users already exist.
 *
 * Never use this script to reset or replace existing accounts.
 */

import 'reflect-metadata';
import * as readline from 'node:readline';
import { createHash } from 'node:crypto';
import { hash, Algorithm } from '@node-rs/argon2';
import { createPrismaClient } from '@recafco/database';

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,49}$/;

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function promptHiddenPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw ?? false;

    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    stdin.resume();

    let password = '';

    const onData = (ch: Buffer): void => {
      const c = ch.toString('utf8');
      if (c === '\r' || c === '\n' || c === '') {
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (c === '') {
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        reject(new Error('Aborted by user'));
      } else if (c === '' || c === '\b') {
        if (password.length > 0) password = password.slice(0, -1);
      } else {
        password += c;
      }
    };

    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.error('[bootstrap] ERROR: DATABASE_URL environment variable is not set.');
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let username: string;
  try {
    username = (await question(rl, 'Admin username: ')).toLowerCase().trim();
  } finally {
    rl.close();
  }

  if (!USERNAME_RE.test(username)) {
    console.error(
      '[bootstrap] ERROR: Invalid username. Must be 3–50 characters: lowercase letters, digits, dots, underscores, or hyphens; must start with a letter or digit.',
    );
    process.exitCode = 1;
    return;
  }

  let password: string;
  try {
    password = await promptHiddenPassword('Admin password (hidden): ');
  } catch (err) {
    console.error('[bootstrap]', (err as Error).message);
    process.exitCode = 1;
    return;
  }

  if (password.length < 10) {
    console.error('[bootstrap] ERROR: Password must be at least 10 characters.');
    process.exitCode = 1;
    return;
  }
  if (password.length > 128) {
    console.error('[bootstrap] ERROR: Password must not exceed 128 characters.');
    process.exitCode = 1;
    return;
  }

  // createPrismaClient requires the URL to be in the env at driver level.
  // The .env file is already loaded via dotenv/config.
  const db = createPrismaClient({
    databaseUrl: dbUrl,
    poolMax: 1,
    connectionTimeoutMs: 10_000,
    statementTimeoutMs: 30_000,
  });

  try {
    await db.$connect();

    const existingCount = await db.user.count();
    if (existingCount > 0) {
      console.error(
        '[bootstrap] Bootstrap blocked: users already exist. Use the admin interface to manage users.',
      );
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    // Clear the plain password from memory as soon as hashed.
    password = createHash('sha256').update('cleared').digest('hex');

    const superAdminRole = await db.role.findUnique({
      where: { code: 'SUPER_ADMIN' },
      select: { id: true },
    });
    if (!superAdminRole) {
      console.error('[bootstrap] ERROR: SUPER_ADMIN role not found. Apply migration 0003 before running this script.');
      process.exitCode = 1;
      return;
    }

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          displayName: username,
          passwordHash,
          role: { connect: { id: superAdminRole.id } },
          isActive: true,
          mustChangePassword: true,
        },
        select: { id: true, username: true },
      });
      await tx.securityAuditEvent.create({
        data: {
          event: 'bootstrap_admin_created',
          userId: user.id,
          metadata: { username: user.username, roleCode: 'SUPER_ADMIN' },
        },
      });
      return user;
    });

    console.log(
      `[bootstrap] Complete. Username: ${username}. Log in and change your password immediately.`,
    );
  } finally {
    await db.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error('[bootstrap] Fatal error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
