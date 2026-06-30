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
});
