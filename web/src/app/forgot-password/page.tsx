import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/PasswordRecovery';
import { localizedMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    ...(await localizedMetadata({ tr: 'Şifremi unuttum', en: 'Forgot password' })),
    robots: { index: false },
  };
}

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
