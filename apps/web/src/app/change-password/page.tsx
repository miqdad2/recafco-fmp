import type { Metadata } from 'next';
import { changePasswordAction } from './actions';
import { ChangePasswordForm } from './_components/change-password-form';

export const metadata: Metadata = { title: 'Change Password — RECAFCO FMP' };

export default function ChangePasswordPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">RECAFCO FMP</h1>
        </div>

        <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-1">Change your password</h2>
          <p className="text-sm text-text-secondary mb-5">
            You must set a new password before continuing. All active sessions will be signed out.
          </p>
          <ChangePasswordForm action={changePasswordAction} />
        </div>
      </div>
    </div>
  );
}
