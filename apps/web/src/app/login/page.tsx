import type { Metadata } from 'next';
import { loginAction } from './actions';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = { title: 'Sign in — RECAFCO FMP' };

export default function LoginPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">RECAFCO FMP</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Factory Management Platform
          </p>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-5">Sign in</h2>
          <LoginForm action={loginAction} />
        </div>
      </div>
    </div>
  );
}
