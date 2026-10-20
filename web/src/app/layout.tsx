import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { DEFAULT_LOCALE, isLocale } from '@devacademy/shared';
import { Providers, themeInitScript } from '@/components/providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { LOCALE_COOKIE } from '@/i18n';
import './globals.css';

const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'DevAcademy', template: '%s · DevAcademy' },
  description:
    'Yazılım mimarisi, sistem tasarımı ve yapay zekâyı animasyonlu, interaktif derslerle öğrenin.',
  applicationName: 'DevAcademy',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'DevAcademy', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1e' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  // middleware.ts'nin ürettiği CSP nonce'u (satır içi tema betiği için)
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <Providers locale={locale}>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
