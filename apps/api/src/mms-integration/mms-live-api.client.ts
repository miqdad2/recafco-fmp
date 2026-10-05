import { Injectable } from '@nestjs/common';
import { getApiEnv } from '../env';

// ---------------------------------------------------------------------------
// FMP-MAINT-02 — server-to-server client for MMS's read-only live dashboard
// API (GET {MMS_BASE_URL}{MMS_LIVE_DASHBOARD_ENDPOINT}). The integration key
// is read from env here and sent ONLY in the x-fmp-integration-key request
// header. It is never returned, logged, or included in an error message.
// This client only ever issues GET.
// ---------------------------------------------------------------------------

export const MMS_INTEGRATION_KEY_HEADER = 'x-fmp-integration-key';

export interface MmsLiveApiConfig {
  /** INTERNAL MMS address — the only URL this client ever calls. Never shown to users. */
  baseUrl: string;
  /** PUBLIC MMS address — used only to build the links users click. Never called by FMP. */
  publicBaseUrl: string;
  endpoint: string;
  integrationKey: string | null;
  timeoutMs: number;
}

export type MmsFetchResult =
  | { kind: 'ok'; body: unknown }
  | { kind: 'not_configured' }
  /** MMS rejected the key (401 missing / 403 invalid). */
  | { kind: 'auth_error'; httpStatus: number }
  /** MMS has the integration disabled (503) or does not serve the endpoint (404 / redirect to login). */
  | { kind: 'not_enabled'; reason: string }
  /** MMS rejected the userEmail parameter. */
  | { kind: 'bad_request' }
  /** 5xx, timeout, network failure, or non-JSON body. */
  | { kind: 'unavailable'; reason: string };

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

@Injectable()
export class MmsLiveApiClient {
  /** Overridable in tests. */
  protected fetchImpl: FetchLike = (url, init) => fetch(url, init);

  config(): MmsLiveApiConfig {
    const env = getApiEnv();
    return {
      baseUrl: env.mmsBaseUrl,
      publicBaseUrl: env.mmsPublicBaseUrl,
      endpoint: env.mmsLiveDashboardEndpoint,
      integrationKey: env.mmsIntegrationKey,
      timeoutMs: env.mmsQueryTimeoutMs,
    };
  }

  async fetchLiveDashboard(userEmail: string | null): Promise<MmsFetchResult> {
    const { baseUrl, endpoint, integrationKey, timeoutMs } = this.config();
    if (!integrationKey) return { kind: 'not_configured' };

    const url = new URL(`${baseUrl}${endpoint}`);
    if (userEmail) url.searchParams.set('userEmail', userEmail);

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json', [MMS_INTEGRATION_KEY_HEADER]: integrationKey },
        // Never follow a redirect: a redirect here means MMS's session
        // middleware intercepted the request (endpoint not deployed), and
        // following it could forward the key to another URL.
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      return { kind: 'unavailable', reason: describeFetchError(err) };
    }

    if (res.status >= 300 && res.status < 400) {
      return { kind: 'not_enabled', reason: 'live endpoint not deployed on MMS yet (MMS redirected to login)' };
    }
    if (res.status === 401 || res.status === 403) return { kind: 'auth_error', httpStatus: res.status };
    if (res.status === 503) return { kind: 'not_enabled', reason: 'MMS integration key is not configured on the MMS server' };
    if (res.status === 404) return { kind: 'not_enabled', reason: 'MMS live endpoint not found' };
    if (res.status === 400) return { kind: 'bad_request' };
    if (!res.ok) return { kind: 'unavailable', reason: `MMS returned HTTP ${res.status}` };

    try {
      return { kind: 'ok', body: (await res.json()) as unknown };
    } catch {
      return { kind: 'unavailable', reason: 'MMS returned a non-JSON response' };
    }
  }
}

/** Credential-free description of a fetch failure. */
export function describeFetchError(err: unknown): string {
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return 'request timed out';
  // undici puts the socket error on `cause`, or on `cause.errors[0]` when it
  // tried several addresses (AggregateError).
  const cause = (err as { cause?: { code?: unknown; errors?: { code?: unknown }[] } } | null)?.cause;
  const code = cause?.code ?? cause?.errors?.[0]?.code;
  if (code === 'ECONNREFUSED') return 'connection refused';
  if (code === 'ENOTFOUND') return 'host not found';
  if (code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'host unreachable';
  if (code === 'ECONNRESET') return 'connection reset';
  return 'network error';
}
