import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/PasswordRecovery';
import { localizedMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    ...(await localizedMetadata({ tr: 'Şifre sıfırla', en: 'Reset password' })),
    robots: { index: false },
  };
}

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
