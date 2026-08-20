import { describe, it, expect } from 'vitest';
import type { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './flatten-validation-errors';

function makeError(overrides: Partial<ValidationError>): ValidationError {
  return { property: 'field', children: [], ...overrides } as ValidationError;
}

describe('flattenValidationErrors', () => {
  it('flattens a top-level constraint violation', () => {
    const errors = [makeError({ property: 'title', constraints: { isNotEmpty: 'title should not be empty' } })];
    expect(flattenValidationErrors(errors)).toEqual({ title: ['title should not be empty'] });
  });

  it('flattens a nested array error (e.g. boqItems.0.unitPrice)', () => {
    const errors = [
      makeError({
        property: 'boqItems',
        children: [
          makeError({
            property: '0',
            children: [
              makeError({ property: 'unitPrice', constraints: { min: 'unitPrice must not be less than 0' } }),
            ],
          }),
        ],
      }),
    ];
    expect(flattenValidationErrors(errors)).toEqual({
      'boqItems.0.unitPrice': ['unitPrice must not be less than 0'],
    });
  });

  it('merges multiple constraint messages for the same field', () => {
    const errors = [
      makeError({
        property: 'unitPrice',
        constraints: { min: 'must not be less than 0', isNumber: 'must be a number' },
      }),
    ];
    expect(flattenValidationErrors(errors)).toEqual({
      unitPrice: ['must not be less than 0', 'must be a number'],
    });
  });

  it('handles multiple invalid array items independently', () => {
    const errors = [
      makeError({
        property: 'boqItems',
        children: [
          makeError({
            property: '0',
            children: [makeError({ property: 'description', constraints: { isNotEmpty: 'required' } })],
          }),
          makeError({
            property: '1',
            children: [makeError({ property: 'unitPrice', constraints: { min: 'must not be negative' } })],
          }),
        ],
      }),
    ];
    expect(flattenValidationErrors(errors)).toEqual({
      'boqItems.0.description': ['required'],
      'boqItems.1.unitPrice': ['must not be negative'],
    });
  });

  it('returns an empty object for an empty error list', () => {
    expect(flattenValidationErrors([])).toEqual({});
  });
});
