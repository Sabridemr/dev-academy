/**
 * İçerik Güvenlik Politikası (CSP). connect-src, build anındaki NEXT_PUBLIC_API_URL'den hesaplanır
 * (API ve WebSocket aynı origin'de). Next.js App Router ve tema betiği satır içi script kullandığı için
 * script-src'de 'unsafe-inline' gerekir (nonce tabanlı CSP ileride middleware ile eklenebilir);
 * yine de dış kaynaklı script, eklenti nesneleri, base etiketi ve çerçeveleme engellenir.
 * 'wasm-unsafe-eval': Shiki'nin Oniguruma WASM motoru için.
 */
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').origin;
const wsOrigin = apiOrigin.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';
const google = 'https://accounts.google.com';
const apple = 'https://appleid.cdn-apple.com https://appleid.apple.com';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''} ${google} ${apple}`,
  `style-src 'self' 'unsafe-inline' ${google}`,
  `img-src 'self' data: blob: https:${isDev ? ' http://localhost:*' : ''}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin} ${google} https://appleid.apple.com${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
  `frame-src ${google} https://appleid.apple.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://appleid.apple.com",
  "frame-ancestors 'self'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared paketi kaynak olarak derlenmez (dist kullanılır) ama ESM/CJS uyumu için transpile listesine alıyoruz
  transpilePackages: ['@devacademy/shared'],
  // SVG temizleyici sunucuda jsdom kullanır; jsdom paketlenmez, Node'dan yüklenir
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  output: 'standalone',
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
