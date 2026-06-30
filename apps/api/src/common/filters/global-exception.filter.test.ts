import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function makeMockHost(responseMock: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getResponse: () => responseMock,
    }),
  } as never;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let statusFn: ReturnType<typeof vi.fn>;
  let jsonFn: ReturnType<typeof vi.fn>;
  let response: Record<string, unknown>;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    jsonFn = vi.fn();
    statusFn = vi.fn(() => ({ json: jsonFn }));
    response = { status: statusFn };
  });

  it('returns the HTTP status code from HttpException', () => {
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), makeMockHost(response));
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('returns 500 for unknown errors', () => {
    filter.catch(new Error('boom'), makeMockHost(response));
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('does not leak internal error details for unknown errors', () => {
    filter.catch(new Error('secret internal failure'), makeMockHost(response));
    const body = (jsonFn.mock.calls[0] as [ReturnType<typeof jsonFn>])[0];
    expect(body.error.message).not.toContain('secret internal failure');
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('response body has the required shape', () => {
    filter.catch(new HttpException('Bad Request', HttpStatus.BAD_REQUEST), makeMockHost(response));
    const body = (jsonFn.mock.calls[0] as [ReturnType<typeof jsonFn>])[0];
    expect(body.data).toBeNull();
    expect(body.meta).toBeDefined();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBeDefined();
    expect(body.error.message).toBeDefined();
  });

  it('prefers code field over error field in exception response', () => {
    filter.catch(
      new HttpException({ code: 'DUPLICATE_CODE', message: 'Code already exists' }, HttpStatus.CONFLICT),
      makeMockHost(response),
    );
    const body = (jsonFn.mock.calls[0] as [ReturnType<typeof jsonFn>])[0];
    expect(body.error.code).toBe('DUPLICATE_CODE');
    expect(body.error.message).toBe('Code already exists');
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('includes details in error response when provided', () => {
    filter.catch(
      new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Validation failed', details: { fields: { code: ['too short'] } } },
        HttpStatus.BAD_REQUEST,
      ),
      makeMockHost(response),
    );
    const body = (jsonFn.mock.calls[0] as [ReturnType<typeof jsonFn>])[0];
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual({ fields: { code: ['too short'] } });
  });

  it('omits details when not provided', () => {
    filter.catch(
      new HttpException({ code: 'NOT_FOUND', message: 'Not found' }, HttpStatus.NOT_FOUND),
      makeMockHost(response),
    );
    const body = (jsonFn.mock.calls[0] as [ReturnType<typeof jsonFn>])[0];
    expect('details' in body.error).toBe(false);
  });

  it('maps generic NestJS NotFoundException (no explicit code field) to NOT_FOUND', () => {
    // NestJS produces { statusCode: 404, message: "Not Found", error: "Not Found" }
    // The human-readable error phrase must not be used verbatim as the code.
    filter.catch(
      new HttpException({ statusCode: 404, message: 'Not Found', error: 'Not Found' }, HttpStatus.NOT_FOUND),
      makeMockHost(response),
    );
    const body = (jsonFn.mock.calls[0] as [ReturnType<typeof jsonFn>])[0];
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('maps generic NestJS MethodNotAllowedException to METHOD_NOT_ALLOWED', () => {
    filter.catch(
      new HttpException({ statusCode: 405, message: 'Method Not Allowed', error: 'Method Not Allowed' }, 405),
      makeMockHost(response),
    );
    const body = (jsonFn.mock.calls[0] as [ReturnType<typeof jsonFn>])[0];
    expect(statusFn).toHaveBeenCalledWith(405);
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});
