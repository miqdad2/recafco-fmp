import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateContractBasicDetailsDto } from './update-contract-basic-details.dto';

const ok = { version: 1, jobOrder: 'JO-1', title: 'P', counterpartyName: 'C' };
const errorsFor = async (o: object): Promise<string[]> =>
  (await validate(plainToInstance(UpdateContractBasicDetailsDto, o))).map((e) => e.property);

describe('UpdateContractBasicDetailsDto (FMP-CONTRACT-03)', () => {
  it('accepts the minimal required shape and nulls for optional fields', async () => {
    expect(await errorsFor(ok)).toEqual([]);
    expect(await errorsFor({ ...ok, endDate: null, notes: null, projectNumber: null })).toEqual([]);
  });

  it.each(['jobOrder', 'title', 'counterpartyName'])('requires %s (blank rejected)', async (f) => {
    expect(await errorsFor({ ...ok, [f]: '   ' })).toContain(f);
    expect(await errorsFor({ ...ok, [f]: undefined })).toContain(f);
  });

  it('Schedule Status is optional and limited to the 5 allowed values', async () => {
    expect(await errorsFor({ ...ok, scheduleStatus: 'ON_TRACK' })).toEqual([]);
    expect(await errorsFor({ ...ok, scheduleStatus: null })).toEqual([]);
    expect(await errorsFor({ ...ok, scheduleStatus: 'ACTIVE' })).toContain('scheduleStatus');
    expect(await errorsFor({ ...ok, scheduleStatus: 'ON_HOLD' })).toContain('scheduleStatus');
  });
});
