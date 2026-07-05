import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrgListQueryDto } from './org-list-query.dto';

// The backend retains @Max(100). The frontend corrected its requests to use pageSize: 100.
describe('OrgListQueryDto pageSize validation', () => {
  async function validationErrors(pageSize: number) {
    const dto = plainToInstance(OrgListQueryDto, { pageSize: String(pageSize) });
    const errors = await validate(dto);
    return errors.filter((e) => e.property === 'pageSize');
  }

  it('T1 - accepts pageSize=100 (at the current limit)', async () => {
    const errs = await validationErrors(100);
    expect(errs).toHaveLength(0);
  });

  it('T2 - rejects pageSize=101 (above current limit)', async () => {
    const errs = await validationErrors(101);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]!.constraints).toMatchObject({ max: expect.any(String) });
  });

  it('T3 - rejects pageSize=200 (what the frontend erroneously sent before the fix)', async () => {
    const errs = await validationErrors(200);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('T4 - rejects pageSize=0 (below min)', async () => {
    const errs = await validationErrors(0);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('T5 - accepts pageSize=1 (minimum valid)', async () => {
    const errs = await validationErrors(1);
    expect(errs).toHaveLength(0);
  });

  it('T6 - defaults to 20 when pageSize omitted', () => {
    const dto = plainToInstance(OrgListQueryDto, {});
    expect(dto.pageSize).toBe(20);
  });
});
