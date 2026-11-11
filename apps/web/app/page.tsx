'use client';
import { LanguageSwitcher } from '@/components/language-provider';
import { t } from '@/lib/i18n';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main>
      <section className="container" style={{ padding: '3rem 0 2rem' }}>
        <LanguageSwitcher />
        <h1 style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>OPEN_TA</h1>
        <p style={{ maxWidth: 680, color: 'var(--muted)' }}>{t("Web-based thematic analysis tool for coding documents on desktop and mobile.")}</p>
        <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.6rem' }}>
          <Link className="nav-link" href="/register">{t("Sign Up")}</Link>
          <Link className="nav-link" href="/login">{t("Sign In")}</Link>
        </div>
      </section>
    </main>
  );
}
