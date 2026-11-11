'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { getLocale } from '@/lib/i18n';
// Resolve the persisted preference before rendering localized client screens.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { document.documentElement.lang = getLocale(); setReady(true); }, []);
  return ready ? children : null;
}
export function LanguageSwitcher() {
  return <label className="language-switcher">🌐 <span className="sr-only">Jazyk / Language</span>
    <select aria-label="Jazyk / Language" value={getLocale()} onChange={(event) => {
      document.cookie = `open-ta-language=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax`;
      window.location.reload();
    }}><option value="cs">Čeština</option><option value="en">English</option></select>
  </label>;
}
