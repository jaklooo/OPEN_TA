'use client';
import { LanguageSwitcher } from '@/components/language-provider';

import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="container" style={{ padding: '2rem 0' }}>
      <LanguageSwitcher />
      <LoginForm />
    </main>
  );
}
