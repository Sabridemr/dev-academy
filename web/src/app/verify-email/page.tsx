import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyEmailView } from '@/components/auth/PasswordRecovery';
import { localizedMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    ...(await localizedMetadata({ tr: 'E-posta doğrulama', en: 'Verify email' })),
    robots: { index: false },
  };
}

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
