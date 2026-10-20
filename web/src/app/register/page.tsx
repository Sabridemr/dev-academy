import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { localizedMetadata } from '@/lib/metadata';

export function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ tr: 'Kayıt ol', en: 'Sign up' });
}

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
