'use client';
import { t } from '@/lib/i18n';


import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/projects');
    } catch (err) {
      setError((err as Error).message || t("Login failed"));
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
      <h2>{t("Sign In")}</h2>
      {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.7rem' }}>
        <label>{t("Email")}<input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <label>{t("Password")}<input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? t("Signing in...") : t("Sign In")}
        </button>
      </form>
      <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>{t("No account?")}<Link href="/register">{t("Create one")}</Link>
      </p>
    </div>
  );
}
