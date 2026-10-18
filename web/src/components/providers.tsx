'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n';
import { RealtimeBridge } from './realtime';

export function Providers({ locale, children }: { locale: string; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: (count, err) => count < 2 && !(err as { status?: number }).status?.toString().startsWith('4'), refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale={locale}>
        <ThemeSync />
        <RealtimeBridge />
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Sistem teması değişirse ve kullanıcı manuel seçim yapmadıysa güncelle */
function ThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const stored = localStorage.getItem('da-theme');
      const dark = stored ? stored === 'dark' : mq.matches;
      document.documentElement.classList.toggle('dark', dark);
    };
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return null;
}

/** <head> içinde ilk boyamadan önce çalışan tema betiği (FOUC engeller) */
export const themeInitScript = `(function(){try{var s=localStorage.getItem('da-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
