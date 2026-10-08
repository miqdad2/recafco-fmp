import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildCredentialsText } from '../_components/credentials-text';

// FMP-AUTH-01 — email is the visible login identity; username is internal only.
const ROOT = path.join(__dirname, '..');
const WIZARD = fs.readFileSync(path.join(ROOT, '_components', 'new-user-wizard.tsx'), 'utf-8');
const ACTIONS = fs.readFileSync(path.join(ROOT, 'actions.ts'), 'utf-8');
const LOGIN = fs.readFileSync(
  path.join(ROOT, '..', '..', '..', 'login', '_components', 'login-form.tsx'),
  'utf-8',
);

describe('login page', () => {
  it('labels the field Email with the company-email placeholder', () => {
    expect(LOGIN).toMatch(/>\s*Email\s*</);
    expect(LOGIN).toContain('placeholder="Enter company email"');
    expect(LOGIN).not.toMatch(/>\s*Email \/ Username\s*</);
    expect(LOGIN).not.toContain('placeholder="Enter email ID or username"');
  });
});

describe('new user form', () => {
  it('has no Username field or username validation text', () => {
    expect(WIZARD).not.toMatch(/htmlFor="username"/);
    expect(WIZARD).not.toMatch(/name="username"/);
    expect(WIZARD).not.toMatch(/Username/);
    expect(WIZARD).not.toMatch(/lowercase letters/);
  });

  it('asks for Full Name, a required Email and Employee Number with the new placeholders', () => {
    expect(WIZARD).toContain('Full Name');
    expect(WIZARD).toContain('placeholder="name@recafco.com"');
    expect(WIZARD).toContain('placeholder="EMP-001"');
    expect(WIZARD).not.toContain('optional@example.com');
    expect(WIZARD).toMatch(/id="email"[\s\S]*?required/);
  });

  it('does not send a username to the API', () => {
    const start = ACTIONS.indexOf('export async function createUserWithAccessAction');
    const action = ACTIONS.slice(start, ACTIONS.indexOf('\nexport ', start + 10));
    expect(action).not.toMatch(/username/);
    expect(action).toContain("Email is required");
  });
});

describe('created-user success screen', () => {
  it('shows Login Email and Temporary Password, not Username', () => {
    expect(WIZARD).toContain('Login Email');
    expect(WIZARD).toContain('Temporary Password');
    expect(WIZARD).toContain('Share the login email and temporary password with the user.');
  });

  it('copies login email, password, role and module access', () => {
    const text = buildCredentialsText({
      email: 'a@recafco.com',
      tempPassword: 'pw',
      roleLabel: 'Viewer',
      moduleAccessLines: ['Contracts: All Departments'],
    });
    expect(text).toBe(
      'Login Email: a@recafco.com\nTemporary Password: pw\nRole: Viewer\nModule Access: Contracts: All Departments',
    );
    expect(text).not.toMatch(/username/i);
  });
});
