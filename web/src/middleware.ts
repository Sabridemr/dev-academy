import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';

/**
 * Her sayfa isteğine yeni bir CSP nonce'u üretir. Next.js, istek başlığındaki CSP'den nonce'u okuyup
 * kendi satır içi betiklerine ekler; kök layout tema betiği için `x-nonce` başlığını kullanır.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Statik dosyalar (service worker, manifest, ikonlar, Pyodide çalışma zamanı dahil) ve önceden getirme (prefetch) istekleri nonce gerektirmez
      source:
        '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|pyodide/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
