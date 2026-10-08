import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANY_PERMISSION_KEY } from '../common/decorators/any-permission.decorator';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { applyFullPlatformAccess } from '../common/full-platform-access';
import { TechnicalController } from './technical.controller';
import { TechnicalBoqConfirmationController } from './technical-boq-confirmation.controller';
import { TechnicalBoqPieceController } from './technical-boq-piece.controller';
import { TechnicalDrawingGroupController } from './technical-drawing-group.controller';
import { TechnicalDrawingGroupFileController } from './technical-drawing-group-file.controller';
import { canDeleteOthersTechnicalFiles, hasTechnicalRead, hasTechnicalWrite } from './technical-permissions';

const CONTROLLERS = [
  TechnicalController,
  TechnicalBoqConfirmationController,
  TechnicalBoqPieceController,
  TechnicalDrawingGroupController,
  TechnicalDrawingGroupFileController,
];

const MIGRATION = readFileSync(
  join(__dirname, '../../../../packages/database/prisma/migrations/20261008300000_add_technical_permissions_and_roles/migration.sql'),
  'utf8',
);

/** Role → codes the migration grants, parsed from the SQL so the test fails if the seed drifts. */
function grantsFor(role: string): string[] {
  const out: string[] = [];
  for (const block of MIGRATION.split('INSERT INTO "role_permissions"').slice(1)) {
    const roles = /r\.code (?:=|IN) \(?([^)]*?)\)?\s*(?:AND|\n)/s.exec(block)?.[1] ?? '';
    const codes = /p\.code (?:=|IN) \(?([^)]*?)\)?\s*ON CONFLICT/s.exec(block)?.[1] ?? '';
    if (roles.includes(`'${role}'`)) out.push(...(codes.match(/'([a-z_.]+)'/g) ?? []).map((c) => c.replace(/'/g, '')));
  }
  return out;
}

describe('Technical permissions seed (migration 20261008300000)', () => {
  it('creates technical.read, technical.update and technical.manage', () => {
    for (const code of ['technical.read', 'technical.update', 'technical.manage']) {
      expect(MIGRATION).toContain(`'${code}'`);
    }
  });

  it('is additive: only INSERT statements (no DELETE, DROP, UPDATE, ALTER or TRUNCATE)', () => {
    expect(MIGRATION).not.toMatch(/^\s*(DELETE\s+FROM|DROP\s|TRUNCATE\s|UPDATE\s+"|ALTER\s)/im);
  });

  it('Technical Staff has technical.read and technical.update only', () => {
    expect(grantsFor('TECHNICAL_STAFF').sort()).toEqual(['technical.read', 'technical.update']);
  });

  it('Technical Manager has read, update and manage', () => {
    expect(grantsFor('TECHNICAL_MANAGER').sort()).toEqual(['technical.manage', 'technical.read', 'technical.update']);
  });

  it('Executive Manager, Admin and Super Admin get all three; Viewer gets read only', () => {
    for (const r of ['EXECUTIVE_MANAGER', 'ADMIN', 'SUPER_ADMIN']) {
      expect(grantsFor(r).sort()).toEqual(['technical.manage', 'technical.read', 'technical.update']);
    }
    expect(grantsFor('VIEWER')).toEqual(['technical.read']);
  });

  it('does not touch Contract Manager or Contract Staff', () => {
    expect(MIGRATION).not.toContain('CONTRACT_MANAGER');
    expect(MIGRATION).not.toContain('CONTRACT_STAFF');
  });

  it('Technical roles carry no Contract Management, Production, Storage or admin permission', () => {
    for (const r of ['TECHNICAL_STAFF', 'TECHNICAL_MANAGER']) {
      expect(grantsFor(r).every((c) => c.startsWith('technical.'))).toBe(true);
    }
  });
});

describe('Technical permission helpers', () => {
  it('read: technical.read or the older contracts.read', () => {
    expect(hasTechnicalRead(['technical.read'])).toBe(true);
    expect(hasTechnicalRead(['contracts.read'])).toBe(true);
    expect(hasTechnicalRead(['production.read', 'tasks.read'])).toBe(false);
  });

  it('write: technical.update/manage or the older contracts.update/workflow_update, never a read-only role', () => {
    expect(hasTechnicalWrite(['technical.update'])).toBe(true);
    expect(hasTechnicalWrite(['technical.manage'])).toBe(true);
    expect(hasTechnicalWrite(['contracts.update'])).toBe(true);
    expect(hasTechnicalWrite(['contracts.workflow_update'])).toBe(true);
    expect(hasTechnicalWrite(['technical.read'])).toBe(false);
    expect(hasTechnicalWrite(['contracts.read'])).toBe(false);
  });

  it('only managers delete files uploaded by others', () => {
    expect(canDeleteOthersTechnicalFiles(['technical.manage'])).toBe(true);
    expect(canDeleteOthersTechnicalFiles(['contracts.manage'])).toBe(true);
    expect(canDeleteOthersTechnicalFiles(['technical.update', 'contracts.update'])).toBe(false);
  });

  it('Full Platform Access gives technical.read but not technical.update/manage', () => {
    const p = applyFullPlatformAccess(['contracts.read'], true);
    expect(p).toContain('technical.read');
    expect(p).not.toContain('technical.update');
    expect(p).not.toContain('technical.manage');
  });
});

describe('Technical route guards', () => {
  type Meta = { name: string; any: string[]; all: string[] };
  const routes: Meta[] = CONTROLLERS.flatMap((c) =>
    Object.getOwnPropertyNames(c.prototype)
      .filter((n) => n !== 'constructor')
      .map((n) => {
        const fn = (c.prototype as unknown as Record<string, object>)[n]!;
        return {
          name: `${c.name}.${n}`,
          any: (Reflect.getMetadata(ANY_PERMISSION_KEY, fn) as string[] | undefined) ?? [],
          all: (Reflect.getMetadata(PERMISSIONS_KEY, fn) as string[] | undefined) ?? [],
        };
      }),
  );

  it('has routes to check', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('every read route opens with technical.read and still with contracts.read (Contract Manager unaffected)', () => {
    const reads = routes.filter((r) => r.any.includes('contracts.read'));
    expect(reads.length).toBeGreaterThan(15);
    for (const r of reads) expect(r.any, r.name).toContain('technical.read');
  });

  it('every write route opens with technical.update and still with the older contract workflow codes', () => {
    const writes = routes.filter((r) => r.any.includes('contracts.workflow_update'));
    expect(writes.length).toBeGreaterThan(20);
    for (const r of writes) {
      expect(r.any, r.name).toEqual(['technical.update', 'contracts.update', 'contracts.workflow_update']);
    }
  });

  it('no write route accepts a read permission, so a viewer cannot update', () => {
    for (const r of routes.filter((x) => x.any.includes('technical.update'))) {
      expect(r.any, r.name).not.toContain('technical.read');
      expect(r.any, r.name).not.toContain('contracts.read');
    }
  });

  it('no Technical route still hard-requires contracts.read alone', () => {
    for (const r of routes) expect(r.all, r.name).not.toContain('contracts.read');
  });
});
