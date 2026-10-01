import { ArrowUpRight, Database, ShieldCheck } from 'lucide-react';
import type { MmsLiveStatus } from '@/lib/mms-api';
import { MMS_LIVE_STATUS_DISPLAY, MMS_SYNC_STATUS_WORD, formatSyncTime } from '../../_lib/mms-format';

interface Props {
  /** null = the FMP API itself could not be reached. */
  status: MmsLiveStatus | null;
  /** Server's specific explanation for a non-ONLINE state (never contains secrets). */
  detail: string | null;
  generatedAt: string | null;
  cacheTtlSeconds: number | null;
  refreshSeconds: number;
  mmsBaseUrl: string;
}

function Item({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text-primary">{children}</dd>
    </div>
  );
}

// FMP-MAINT-03 — compact, always-visible "where does this data come from and
// how fresh is it" strip. Replaces MAINT-01/02's side panel so the status is
// read at a glance right under the header, in every state.
export function MmsSyncStrip({ status, detail, generatedAt, cacheTtlSeconds, refreshSeconds, mmsBaseUrl }: Props): React.JSX.Element {
  const dot = status ? MMS_LIVE_STATUS_DISPLAY[status].dot : 'bg-error';
  const word = status ? MMS_SYNC_STATUS_WORD[status] : 'Unavailable';

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <div className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-text-primary">
            <Database className="size-3.5 text-teal" aria-hidden="true" />
            Source: MMS Live API
          </div>
          <Item label="Status">
            <span className="inline-flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
              {word}
            </span>
          </Item>
          <Item label="Last synced">{status === 'ONLINE' && generatedAt ? formatSyncTime(generatedAt) : '—'}</Item>
          <Item label="Refresh">Every {refreshSeconds} s</Item>
          {cacheTtlSeconds !== null && <Item label="MMS cache">{cacheTtlSeconds} s</Item>}
          <div className="flex items-center gap-1 whitespace-nowrap text-text-secondary">
            <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
            Read-only
          </div>
        </dl>
        <a
          href={mmsBaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-accent hover:underline"
        >
          Open MMS
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      </div>
      {status !== 'ONLINE' && detail && <p className="mt-2 border-t border-border pt-2 text-xs text-text-secondary">{detail}</p>}
    </div>
  );
}
