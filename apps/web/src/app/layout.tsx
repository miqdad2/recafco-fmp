import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'RECAFCO Factory Management Platform',
  description: 'Internal factory operations platform',
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, Arial, sans-serif', background: '#f5f7fa' }}>
        {children}
      </body>
    </html>
  );
}
