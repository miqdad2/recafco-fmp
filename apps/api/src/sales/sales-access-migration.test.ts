import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// FMP-SALES-01B — pins the additive Sales visibility migration so a later edit cannot quietly widen access.
const dir = path.resolve(__dirname, '../../../../packages/database/prisma/migrations');
const sql = fs.readFileSync(path.join(dir, '20261023000000_grant_sales_visibility_to_operational_roles/migration.sql'), 'utf8');
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

describe('Sales visibility migration (FMP-SALES-01B)', () => {
  it('is additive and idempotent: only INSERT ... ON CONFLICT DO NOTHING', () => {
    // Statement keywords only (the permission code 'sales.update' is a string literal, not a statement).
    expect(code).not.toMatch(/^\s*(DELETE|UPDATE|TRUNCATE|DROP|ALTER)\b/im);
    const inserts = code.match(/INSERT INTO/gi) ?? [];
    const guards = code.match(/ON CONFLICT DO NOTHING/gi) ?? [];
    expect(inserts.length).toBe(2);
    expect(guards.length).toBe(2);
  });

  it('operational roles get read + reports only', () => {
    const block = code.split('INSERT INTO')[1]!;
    expect(block).toContain("'sales.read', 'sales.reports.read'");
    expect(block).not.toMatch(/sales\.(create|update|manage)/);
    for (const role of ['ADMIN', 'VIEWER', 'CONTRACT_MANAGER', 'CONTRACT_MANAGEMENT_USER']) expect(block).toContain(`'${role}'`);
  });

  it('only EXECUTIVE_MANAGER gets the management permissions', () => {
    const block = code.split('INSERT INTO')[2]!;
    expect(block).toContain("r.code = 'EXECUTIVE_MANAGER'");
    for (const p of ['sales.read', 'sales.reports.read', 'sales.create', 'sales.update', 'sales.manage']) expect(block).toContain(`'${p}'`);
    expect(code.match(/sales\.(create|update|manage)/g)!.length).toBe(3); // appear only in the Executive Manager block
  });

  it('never grants Sales to Management Intelligence, task-only or single-module roles', () => {
    for (const role of ['MANAGEMENT_INTELLIGENCE_VIEWER', 'CONTRACT_STAFF', 'TECHNICAL_MANAGER', 'TECHNICAL_STAFF', 'SALES_MANAGER', 'SALES_VIEWER']) {
      expect(code).not.toContain(role);
    }
  });

  it('the original Sales migration still defines the two Sales roles and SUPER_ADMIN grant', () => {
    const first = fs.readFileSync(path.join(dir, '20261022000000_add_sales_enquiries_foundation/migration.sql'), 'utf8');
    expect(first).toContain("r.code = 'SALES_MANAGER' AND p.code IN ('sales.read','sales.create','sales.update','sales.manage','sales.reports.read')");
    expect(first).toContain("r.code = 'SALES_VIEWER' AND p.code IN ('sales.read','sales.reports.read')");
    expect(first).toContain("r.code = 'SUPER_ADMIN' AND p.code LIKE 'sales.%'");
  });
});
