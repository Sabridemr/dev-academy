'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n';
import { startAuthSession } from '@/lib/api';
import { RealtimeBridge } from './realtime';
import { ToastProvider } from './ui/Toast';

export function Providers({ locale, children }: { locale: string; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (count, err) =>
              count < 2 && !(err as { status?: number }).status?.toString().startsWith('4'),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale={locale}>
        <ToastProvider>
          <AuthSync />
          <ThemeSync />
          <RealtimeBridge />
          {children}
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Oturumu mount'ta localStorage'dan yükler ve sekmeler arası senkronlar */
function AuthSync() {
  useEffect(() => startAuthSession(), []);
  return null;
}

/**
 * Tema: varsayılan koyu (marka kimliği). Kullanıcı seçimi localStorage'da ('da-theme') tutulur ve
 * başka bir sekmede değişirse burada da uygulanır.
 */
function ThemeSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      document.documentElement.classList.toggle('dark', resolveTheme(e.newValue) === 'dark');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}

export const THEME_STORAGE_KEY = 'da-theme';
export type Theme = 'dark' | 'light';

/** Saklanan değer yoksa koyu tema */
export function resolveTheme(stored: string | null | undefined): Theme {
  return stored === 'light' ? 'light' : 'dark';
}

/** Temayı uygular ve saklar (Header'daki düğme kullanır) */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* gizli mod vb. */
  }
}

/** <head> içinde ilk boyamadan önce çalışan tema betiği (FOUC engeller). Varsayılan koyu. */
export const themeInitScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;
