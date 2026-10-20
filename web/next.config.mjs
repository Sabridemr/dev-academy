// CSP istek başına nonce ile src/middleware.ts'de (src/lib/csp.ts) üretilir
const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared paketi kaynak olarak derlenmez (dist kullanılır) ama ESM/CJS uyumu için transpile listesine alıyoruz
  transpilePackages: ['@devacademy/shared'],
  // SVG temizleyici sunucuda jsdom kullanır; jsdom paketlenmez, Node'dan yüklenir
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  output: 'standalone',
  poweredByHeader: false,
  // Lint CI’da ayrı adımda (kök eslint.config.mjs) çalışır; build sırasında tekrarlanmaz
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isDev
            ? []
            : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
        ],
      },
      {
        // Service worker her açılışta yeniden doğrulansın (eski sürüm takılı kalmasın)
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },
};

export default nextConfig;
