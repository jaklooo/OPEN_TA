import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'OPEN_TA',
  description: 'Open thematic analysis for desktop and mobile'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
