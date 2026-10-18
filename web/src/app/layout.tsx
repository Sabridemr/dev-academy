import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { DEFAULT_LOCALE, isLocale } from '@devacademy/shared';
import { Providers, themeInitScript } from '@/components/providers';
import { Header } from '@/components/layout/Header';
import { LOCALE_COOKIE } from '@/i18n';
import './globals.css';

const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'DevAcademy', template: '%s · DevAcademy' },
  description: 'Yazılım mimarisi, sistem tasarımı ve yapay zekâyı animasyonlu, interaktif derslerle öğrenin.',
  applicationName: 'DevAcademy',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return (
    <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers locale={locale}>
          <Header />
          <main id="main">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
