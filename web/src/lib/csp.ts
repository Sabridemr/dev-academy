/**
 * İçerik Güvenlik Politikası (CSP). connect-src, build anındaki NEXT_PUBLIC_API_URL'den hesaplanır
 * (API ve WebSocket aynı origin'de). script-src'de 'unsafe-inline' YOK: Next.js'in satır içi betikleri
 * ve tema betiği istek başına üretilen nonce ile çalışır (middleware.ts). Böylece enjekte edilmiş bir
 * satır içi betik çalışamaz.
 * 'wasm-unsafe-eval': Shiki'nin Oniguruma WASM motoru için. style-src'deki 'unsafe-inline' framer-motion
 * ve next/font satır içi stilleri içindir (stil enjeksiyonu betik çalıştıramaz).
 */
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').origin;
const wsOrigin = apiOrigin.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';
const google = 'https://accounts.google.com';
const apple = 'https://appleid.cdn-apple.com https://appleid.apple.com';

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''} ${google} ${apple}`,
    `style-src 'self' 'unsafe-inline' ${google}`,
    // API: ders görselleri (/assets) — http olabilir (yerel ağ / homelab)
    `img-src 'self' data: blob: https: ${apiOrigin}${isDev ? ' http://localhost:*' : ''}`,
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} ${wsOrigin} ${google} https://appleid.apple.com${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
    `frame-src ${google} https://appleid.apple.com`,
    // Service worker (/sw.js) ve PWA manifest'i yalnızca aynı origin'den
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://appleid.apple.com",
    "frame-ancestors 'self'",
  ].join('; ');
}
