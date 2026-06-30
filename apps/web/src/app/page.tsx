import React from 'react';
import { getWebEnv } from '../lib/env';
import { getApiHealth } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<React.JSX.Element> {
  const env = getWebEnv();
  const apiBaseUrl = env?.apiBaseUrl ?? 'http://localhost:4000';
  const health = await getApiHealth(apiBaseUrl);

  return (
    <main style={{ maxWidth: '600px', margin: '80px auto', padding: '0 24px' }}>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#172033',
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        RECAFCO Factory Management Platform
      </h1>
      <p style={{ marginTop: '12px', color: '#475467', fontSize: '1rem' }}>
        Foundation setup in progress
      </p>

      <section style={{ marginTop: '32px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#172033',
            margin: '0 0 8px 0',
          }}
        >
          Runtime Status
        </h2>
        {health.ok ? (
          <p style={{ margin: 0, color: '#027a48', fontSize: '0.875rem' }}>
            API online &mdash; {health.data.service}
          </p>
        ) : (
          <p style={{ margin: 0, color: '#b42318', fontSize: '0.875rem' }}>
            API unavailable &mdash; {health.reason}
          </p>
        )}
      </section>
    </main>
  );
}
