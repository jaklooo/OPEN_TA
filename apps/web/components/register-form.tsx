'use client';
import { t } from '@/lib/i18n';


import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const { register, isLoading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await register(email, password, displayName);
      router.push('/projects');
    } catch (err) {
      setError((err as Error).message || t("Registration failed"));
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
      <h2>{t("Create Account")}</h2>
      {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.7rem' }}>
        <label>{t("Display Name")}<input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <label>{t("Email")}<input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <label>{t("Password (min 8 chars)")}<input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            style={{ width: '100%' }}
          />
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? t("Creating...") : t("Create Account")}
        </button>
      </form>
      <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>{t("Already have an account?")}<Link href="/login">{t("Sign In")}</Link>
      </p>
    </div>
  );
}
