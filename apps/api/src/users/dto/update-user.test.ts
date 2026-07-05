import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

// P2: UpdateUserDto now accepts null for org fields to enable explicit clearing
describe('UpdateUserDto org field nullable validation', () => {
  async function orgErrors(payload: object) {
    const dto = plainToInstance(UpdateUserDto, payload);
    const errors = await validate(dto);
    return errors.filter((e) => ['departmentId', 'plantId', 'locationId'].includes(e.property));
  }

  it('T7 - accepts departmentId=null (explicit clear)', async () => {
    const errs = await orgErrors({ departmentId: null });
    expect(errs).toHaveLength(0);
  });

  it('T8 - accepts valid UUID v4 for departmentId', async () => {
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
    const errs = await orgErrors({ departmentId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890' });
    expect(errs).toHaveLength(0);
  });

  it('T9 - rejects non-UUID string for departmentId', async () => {
    const errs = await orgErrors({ departmentId: 'not-a-uuid' });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]!.property).toBe('departmentId');
  });

  it('T10 - accepts plantId=null (explicit clear)', async () => {
    const errs = await orgErrors({ plantId: null });
    expect(errs).toHaveLength(0);
  });

  it('T11 - accepts locationId=null (explicit clear)', async () => {
    const errs = await orgErrors({ locationId: null });
    expect(errs).toHaveLength(0);
  });

  it('T12 - accepts all three org fields as null simultaneously', async () => {
    const errs = await orgErrors({ departmentId: null, plantId: null, locationId: null });
    expect(errs).toHaveLength(0);
  });

  it('T13 - omitting org fields is valid (no change intended)', async () => {
    const errs = await orgErrors({});
    expect(errs).toHaveLength(0);
  });
});
