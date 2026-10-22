import { describe, it, expect } from 'vitest';
import { MANAGEMENT_MODULES, findModule, moduleHref } from './management-modules';

describe('management modules', () => {
  it('lists the ten approved modules in order', () => {
    expect(MANAGEMENT_MODULES.map((m) => m.title)).toEqual([
      'Executive Overview',
      'Projects & Engineering',
      'Production & Casting',
      'Stock & Delivery',
      'Erection',
      'Daily Performance',
      'Resources & Costs',
      'Targets & Achievement',
      'Delays & Follow-up',
      'Data Quality',
    ]);
  });

  it('has unique slugs and every href stays inside the management area', () => {
    const slugs = MANAGEMENT_MODULES.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const m of MANAGEMENT_MODULES) expect(moduleHref(m)).toBe(`/management/intelligence/${m.slug}`);
  });

  it('resolves known slugs and rejects unknown ones', () => {
    expect(findModule('erection')?.title).toBe('Erection');
    expect(findModule('contracts')).toBeUndefined();
  });
});
