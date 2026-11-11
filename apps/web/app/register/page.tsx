'use client';
import { LanguageSwitcher } from '@/components/language-provider';

import { RegisterForm } from '@/components/register-form';

export default function RegisterPage() {
  return (
    <main className="container" style={{ padding: '2rem 0' }}>
      <LanguageSwitcher />
      <RegisterForm />
    </main>
  );
}
