export interface HealthStatus {
  status: 'ok';
  service: string;
}

export interface ApiHealthResult {
  ok: true;
  data: HealthStatus;
}

export interface ApiHealthError {
  ok: false;
  reason: string;
}

export type ApiHealthOutcome = ApiHealthResult | ApiHealthError;

export async function getApiHealth(baseUrl: string): Promise<ApiHealthOutcome> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    const json = (await response.json()) as {
      data?: { status?: string; service?: string };
    };

    if (
      json.data?.status === 'ok' &&
      typeof json.data.service === 'string'
    ) {
      return { ok: true, data: { status: 'ok', service: json.data.service } };
    }

    return { ok: false, reason: 'Unexpected response shape' };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, reason: 'Request timed out' };
    }
    return { ok: false, reason: 'API unreachable' };
  }
}
