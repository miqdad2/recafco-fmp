import type { Metadata } from 'next';
import Image from 'next/image';
import { ShieldUser } from 'lucide-react';
import { loginAction } from './actions';
import { LoginForm } from './_components/login-form';
import { ThemeToggle } from '../_components/theme-toggle';

export const metadata: Metadata = { title: 'Sign in — RECAFCO FMP' };

// FMP-UI-19 — login redesign (UI only). Background photo elements, asset
// paths and object-position are unchanged from FMP-UI-18B/PERF-02; only the
// CSS overlay gradients were retuned (stronger navy behind the left text,
// lighter through the centre). The module badges, "Authorized Company Access"
// pill and the separate footer card were removed; the security notice now
// lives inside the card under a divider. Left/right split is kept at `lg`;
// below `lg` the large heading is hidden and compact branding is shown.
// "Keep me signed in" and "Forgot password?" are intentionally absent: the
// auth flow has no persistent-session option and no recovery flow.
export default function LoginPage(): React.JSX.Element {
  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-8 xl:pr-24">
      <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
        <img
          src="/login-hero.webp"
          alt=""
          width={2048}
          height={1152}
          className="hidden h-full w-full object-cover object-[60%_40%] lg:block"
        />
        <img
          src="/login-hero-mobile.webp"
          alt=""
          width={1024}
          height={576}
          className="h-full w-full object-cover object-[60%_40%] lg:hidden"
        />
        {/* Navy overlay: strong on the left (behind the text), softer through
            the centre, moderate again on the right behind the card. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.82) 30%, rgba(15,23,42,0.5) 55%, rgba(15,23,42,0.6) 80%, rgba(15,23,42,0.75) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, rgba(15,23,42,0.7) 0%, transparent 25%)' }}
        />
      </div>

      {/* LEFT — desktop branding */}
      <div className="relative z-10 hidden min-h-screen flex-col px-12 pb-9 pt-10 lg:flex xl:px-20 xl:pb-10 xl:pt-12">
        <div className="inline-flex w-fit rounded-2xl bg-white p-4 shadow-xl">
          <Image src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} priority className="h-20 w-auto" />
        </div>

        <div className="mt-10 max-w-2xl xl:mt-12 2xl:mt-16">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="h-0.5 w-10 bg-accent" />
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-white/70">
              Factory Operations System
            </p>
          </div>
          <h1 className="mt-6 font-extrabold leading-[1.12] tracking-[-0.01em] text-white">
            <span className="inline-block bg-accent px-3 py-1 text-[2rem] xl:text-[2.75rem] 2xl:text-[3.5rem]">RECAFCO</span>
            <span className="mt-3 block whitespace-nowrap text-[2rem] xl:text-[2.75rem] 2xl:text-[3.5rem]">Factory Management</span>
            <span className="block text-[2rem] xl:text-[2.75rem] 2xl:text-[3.5rem]">Platform</span>
          </h1>
          <p className="mt-7 max-w-[34rem] text-base leading-[1.7] text-white/85 xl:text-lg">
            One integrated platform for factory operations, contracts, technical, erection, production, safety and maintenance.
          </p>
        </div>

        <p className="mt-auto pt-8 text-sm text-white/70">
          <span className="font-medium text-white/80">RECAFCO</span>
          <span aria-hidden="true" className="mx-3 text-accent">|</span>
          Quality Concrete for a Stronger Kuwait
          <span aria-hidden="true" className="mx-3 text-accent">|</span>
          Since 1976
        </p>
      </div>

      {/* RIGHT — authentication card */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4 pt-16 sm:p-6 sm:pt-16 lg:py-10">
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[500px]">
          <div className="mb-6 text-center lg:hidden">
            <div className="inline-flex rounded-2xl bg-white p-3 shadow-md">
              <Image src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} priority className="h-14 w-auto" />
            </div>
            <h1 className="mt-3 text-lg font-extrabold tracking-tight text-white sm:text-xl">
              RECAFCO Factory Management Platform
            </h1>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 pb-6 pt-8 shadow-xl sm:px-9 sm:pb-7 sm:pt-9">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-accent" />

            <div className="flex flex-col items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent-light text-accent">
                <ShieldUser className="size-7" aria-hidden="true" />
              </span>
              <h2 className="mt-3.5 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
                Welcome Back
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Sign in to RECAFCO Factory Management Platform
              </p>
            </div>

            <div className="mt-6">
              <LoginForm action={loginAction} />
            </div>

            <div className="mt-6 border-t border-border pt-4 text-center">
              <p className="text-xs font-medium tracking-wide text-text-secondary">
                Authorized RECAFCO users only · Internal Use Only
              </p>
              <p className="mt-1 text-xs text-text-muted">© RECAFCO · Since 1976</p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-white/70 lg:hidden">
            RECAFCO | Quality Concrete for a Stronger Kuwait | Since 1976
          </p>
        </div>
      </div>
    </div>
  );
}
