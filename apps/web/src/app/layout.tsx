import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RECAFCO Factory Management Platform',
  description: 'Internal factory operations platform',
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
