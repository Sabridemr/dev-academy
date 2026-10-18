/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared paketi kaynak olarak derlenmez (dist kullanılır) ama ESM/CJS uyumu için transpile listesine alıyoruz
  transpilePackages: ['@devacademy/shared'],
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
        ],
      },
    ];
  },
};

export default nextConfig;
