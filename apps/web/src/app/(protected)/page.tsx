import { redirect } from 'next/navigation';

// FMP-UI-01 — the Executive Platform Dashboard now lives at /dashboard (the
// task's preferred route). Root stays as a stable redirect target since
// login and the sidebar logo both still point here.
export default function RootPage(): never {
  redirect('/dashboard');
}
