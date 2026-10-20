import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { localizedMetadata } from '@/lib/metadata';

export function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ tr: 'Giriş', en: 'Log in' });
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
