import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { WelcomeTransition } from './_components/welcome-transition';

export const metadata: Metadata = { title: 'Welcome — RECAFCO FMP' };

/**
 * FMP-UI-Login-Polish — the short branded transition shown right after a
 * successful sign-in, before landing on the real dashboard. Gated on the
 * same access-token cookie every protected page already checks — visiting
 * this URL directly without a session just bounces to /login, the same as
 * any other protected page would. No auth logic lives here; this page only
 * decides whether to render the transition at all.
 *
 * FMP-UI-12F — removed the `?force=1` bypass and its `searchParams` read:
 * `WelcomeTransition` now always renders on every authenticated visit (the
 * once-per-tab skip guard it used to bypass was removed too), so there is
 * nothing left to force.
 */
export default async function WelcomePage(): Promise<React.JSX.Element> {
  const store = await cookies();
  const accessToken = store.get('recafco_access')?.value;

  if (!accessToken) redirect('/login');

  return <WelcomeTransition />;
}
