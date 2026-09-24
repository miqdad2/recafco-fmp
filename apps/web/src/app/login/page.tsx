import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { loginAction } from './actions';
import { LoginForm } from './_components/login-form';
import { ThemeToggle } from '../_components/theme-toggle';

export const metadata: Metadata = { title: 'Sign in — RECAFCO FMP' };

// FMP-UI-08B — replaces FMP-UI-08's dark-panel-left/card-right split with a
// single centered layout: logo/title/tagline stacked at top, the card
// centered below, footer below that — no side panel at any breakpoint.
//
// FMP-UI-08C — polish pass on that same centered layout (structure
// unchanged): branding area strengthened (bigger logo chip, bigger title, a
// "Secure Internal Access" pill), the background gained a soft central
// radial glow behind the card, and the card itself got a richer shadow,
// softer border, larger radius, and a subtle top sheen.
//
// FMP-UI-Login-Polish / FMP-UI-11 — progressively softened the background
// grid/glows per "still too heavy" feedback; introduced `ThemeToggle` and
// the `--login-glow-center` token so the glow (and the page generally)
// reads correctly in dark mode too.
//
// FMP-UI-13 — enterprise polish pass, structure still unchanged (centered,
// no split panel): grid widened/softened further and corner glows enlarged
// + softened for a calmer "depth" feel instead of visible texture; the
// standalone "Secure Internal Access" pill was removed from the branding
// block (title/tagline alone read cleaner and less crowded) and replaced
// with a small "Secure sign-in" badge inside the card's own header instead
// — moving trust signaling next to the actual form rather than floating
// above it. The card gained a slim top accent bar (`bg-accent`, matches the
// card's own corner radius) as a small brand touch, a crisper full-opacity
// border, and slightly more internal padding for better vertical rhythm.
// `ThemeToggle` moved off the footer entirely to a fixed top-right corner —
// a utility control, not part of the sign-in form — leaving the footer to
// read as a plain, official notice block. None of this touches
// `LoginForm`, `loginAction`, cookies, or the welcome-screen redirect.
export default function LoginPage(): React.JSX.Element {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      {/* Appearance selector — a page utility, not part of the sign-in
          form, so it lives in a fixed corner rather than inside the
          centered content column below. */}
      <div className="fixed right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      {/* Blueprint/control-room grid — two repeating-linear-gradient pairs
          (fine 52px lines + major 280px lines), navy-tinted at very low
          opacity on the light background. No image, no new color token —
          rgba(23,32,51,*) is --color-nav's own RGB. FMP-UI-13 widened the
          spacing and eased the opacity once more so it reads as texture,
          not a visible grid. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg, rgba(23,32,51,0.028) 0px, rgba(23,32,51,0.028) 1px, transparent 1px, transparent 280px)',
            'repeating-linear-gradient(90deg, rgba(23,32,51,0.028) 0px, rgba(23,32,51,0.028) 1px, transparent 1px, transparent 280px)',
            'repeating-linear-gradient(0deg, rgba(23,32,51,0.012) 0px, rgba(23,32,51,0.012) 1px, transparent 1px, transparent 52px)',
            'repeating-linear-gradient(90deg, rgba(23,32,51,0.012) 0px, rgba(23,32,51,0.012) 1px, transparent 1px, transparent 52px)',
          ].join(', '),
        }}
      />

      {/* Soft central radial glow, centered on the same point as the card
          below it — gives the card a sense of depth/being "lit," and its
          own soft edge naturally fades the grid immediately behind the
          card without a second masking layer. Reads a CSS variable (not a
          literal rgba) specifically so dark mode can dim it. FMP-UI-13
          widened it slightly for a bit more spread behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-176 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, var(--login-glow-center) 0%, rgba(255,255,255,0) 70%)' }}
      />

      {/* Corner navy + red glow accents — heavily blurred, low-opacity,
          never a flashy gradient. FMP-UI-13 enlarged and softened these
          once more so they read as ambient depth rather than distinct
          shapes. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-44 -top-44 size-128 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(23,32,51,0.04)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-44 -right-44 size-128 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgba(198,40,40,0.035)' }}
      />

      <div className="relative z-10 w-full max-w-xl">
        {/* Branding — logo, title, tagline. FMP-UI-13 removed the
            standalone trust pill that used to sit here (see the card
            header below for its replacement) so this block reads as a
            clean identity mark, not something competing with the card for
            attention. */}
        <div className="mb-8 text-center">
          <div className="inline-flex rounded-2xl border border-border bg-white p-3.5 shadow-md">
            <img src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} className="h-16 w-auto sm:h-20" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
            RECAFCO Factory Management Platform
          </h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
            Factory Operations System
          </p>
        </div>

        {/* Login card — FMP-UI-13: full-opacity border (was /60) for a
            crisper edge, a slim `bg-accent` top bar as a small brand touch
            (matches the card's own `rounded-3xl` so it reads as one
            seamless shape), and slightly more padding for better vertical
            rhythm. The existing top sheen (a plain gradient overlay, not a
            blur/glass effect) is unchanged. */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-xl sm:p-10">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-accent" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1 h-24 bg-linear-to-b from-white/60 to-transparent dark:from-white/5"
          />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">Sign in</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                <ShieldCheck className="size-3 text-accent" aria-hidden="true" />
                Secure sign-in
              </span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Use your company account to continue to the Factory Operations System.
            </p>

            <div className="mt-8">
              <LoginForm action={loginAction} />
            </div>
          </div>
        </div>

        {/* Footer — a plain, official notice block now that the appearance
            selector lives in its own corner instead of sitting here. */}
        <div className="mt-8 space-y-1.5 text-center">
          <p className="text-xs font-medium tracking-wide text-text-secondary">
            Authorized RECAFCO users only · Internal Use Only
          </p>
          <p className="text-xs text-text-muted">© RECAFCO · Since 1976</p>
        </div>
      </div>
    </div>
  );
}
