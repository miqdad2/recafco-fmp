import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlatformMetric } from '@/lib/platform-api';

/**
 * FMP-UI-36/37/38 — one card for the whole Factory Operations Control Center, in the module-themed style:
 * white surface, 1px border and CTA in the module colour, pastel icon chip and KPI tiles derived from that
 * colour (literal hex via inline style, so the colour never depends on a CSS variable resolving). Same height
 * on every card (grid auto-rows-fr); three zones: header (icon, title, badge, description), body, action.
 *
 * Variants (one component so all seven cards stay identical in structure):
 * - href + metrics: an internal module. The whole card is the one real link; the button is a span.
 *   If every metric is null the badge reads Setup Pending and one honest block replaces the tiles
 *   (null is never shown as 0; a single null among live numbers reads Not available).
 * - external: opens a separate application in a new tab (Factory Performance), no metrics invented.
 * - neither href nor external: a non-clickable placeholder (Sales & Enquiries), no button at all.
 */
export interface CardColor {
  /** Border, icon, dot and button colour. */
  base: string;
  /** Pastel tint for the icon chip. */
  light: string;
}

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  external?: boolean;
  /** Metrics from the platform API (internal modules). */
  metrics?: PlatformMetric[];
  /** Replaces the metric tiles (external / placeholder cards). */
  note?: { heading: string; text: string };
  /** Icon for the setup / note panel (defaults to the card icon) - e.g. a padlock for a restricted card. */
  noteIcon?: LucideIcon | undefined;
  /** Overrides the computed badge. */
  badge?: string;
  /** Module-specific button wording, e.g. "Open Technical". Required for a card with an href. */
  cta?: string | undefined;
  /** Footer text for a card with no destination (replaces the button, so there is never a dead button). */
  footer?: string;
  color: CardColor;
}

const CARD_CLASS =
  'group flex h-full min-h-72 flex-col rounded-2xl border bg-surface p-5 shadow-sm transition-[box-shadow,transform] duration-150';
const LINK_CLASS = `${CARD_CLASS} hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`;

export function ControlCenterCard({ title, description, icon: Icon, href, external, metrics, note, badge, cta, footer, color, noteIcon }: Props): React.JSX.Element {
  const pending = !external && (metrics ? metrics.every((m) => m.value === null) : true);
  const badgeText = badge ?? (pending ? 'Setup Pending' : 'Live');
  const interactive = Boolean(href);
  const NoteIcon = noteIcon ?? Icon;
  const tint = `${color.base}14`;

  const inner = (
    <>
      <div className="flex min-h-11 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color.light, color: color.base }}>
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 text-lg font-bold leading-tight text-text-primary">{title}</h2>
        <span
          className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-wide ${
            badgeText === 'Live' ? 'border-transparent bg-success-light text-success' : 'border-border bg-surface-secondary text-text-secondary'
          }`}
        >
          {badgeText}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-text-secondary">{description}</p>

      <div className="mt-4 flex flex-1 flex-col">
        {note || pending || !metrics ? (
          <div
            className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center"
            style={{ backgroundColor: tint, borderColor: `${color.base}55` }}
          >
            <span className="mb-2 flex size-9 items-center justify-center rounded-full" style={{ backgroundColor: color.light, color: color.base }}>
              <NoteIcon className="size-5" aria-hidden="true" />
            </span>
            <p className="text-base font-bold text-text-primary">{note?.heading ?? 'Setup Pending'}</p>
            <p className="mt-1 text-sm leading-snug text-text-secondary">{note?.text ?? 'Figures will appear here once this module is set up.'}</p>
          </div>
        ) : (
          <dl className="grid flex-1 auto-rows-fr grid-cols-2 gap-2.5">
            {metrics.map((m) => (
              <div key={m.label} className="flex min-h-20 flex-col justify-center rounded-xl px-3 py-2.5" style={{ backgroundColor: tint }}>
                <dd className={m.value !== null ? 'text-3xl font-extrabold tabular-nums leading-none text-text-primary' : 'text-sm font-medium text-text-secondary'}>
                  {m.value !== null ? m.value : 'Not available'}
                </dd>
                <dt className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold leading-tight text-text-secondary">
                  <span className="mt-[0.1875rem] inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color.base }} aria-hidden="true" />
                  <span>{m.label}</span>
                </dt>
              </div>
            ))}
          </dl>
        )}
      </div>

      {interactive ? (
        <span
          className="mt-4 flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition group-hover:brightness-95"
          style={{ backgroundColor: color.base }}
        >
          <span>{cta ?? 'Open'}</span>
          {external ? <ExternalLink className="size-4 shrink-0" aria-hidden="true" /> : <ArrowRight className="size-4 shrink-0" aria-hidden="true" />}
        </span>
      ) : (
        <p className="mt-4 flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl border border-dashed px-4 py-2 text-center text-sm font-semibold text-text-secondary" style={{ borderColor: `${color.base}55` }}>
          {footer ?? 'Setup Pending'}
        </p>
      )}
    </>
  );

  const style = { borderColor: `${color.base}99` };
  if (!href) {
    return (
      <div className={CARD_CLASS} style={style}>
        {inner}
      </div>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS} style={style} aria-label={`Open ${title} Dashboard (opens in a new tab)`}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={LINK_CLASS} style={style} aria-label={`Open ${title} Dashboard`}>
      {inner}
    </Link>
  );
}
