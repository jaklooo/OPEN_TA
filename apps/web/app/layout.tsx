import './globals.css';
import { LanguageProvider } from '@/components/language-provider';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'OPEN_TA',
  description: 'Otevřená tematická analýza pro počítače a mobily'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <LanguageProvider><AuthProvider>{children}</AuthProvider></LanguageProvider>
      </body>
    </html>
  );
}
