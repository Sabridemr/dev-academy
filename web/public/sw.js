/* global self, caches */
/**
 * DevAcademy service worker.
 *  - Statik varlıklar (/_next/static, /icons, fontlar, görseller): cache-first (dosya adları sürümlü).
 *  - Sayfalar (navigate): network-first; ağ yoksa önbellekteki sürüm, o da yoksa /offline.
 *  - API ve başka origin istekleri (kişisel veri) asla önbelleğe alınmaz.
 */
const VERSION = 'v1';
const STATIC_CACHE = `da-static-${VERSION}`;
const PAGE_CACHE = `da-pages-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon.svg'];
const MAX_PAGES = 40;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('da-') && k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|ttf|otf|png|jpe?g|gif|webp|avif|svg|ico)$/i.test(url.pathname)
  );
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(STATIC_CACHE);
    void cache.put(request, res.clone());
  }
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    // Yalnızca başarılı, aynı origin HTML yanıtları saklanır
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(PAGE_CACHE);
      void cache.put(request, res.clone()).then(() => trimCache(PAGE_CACHE, MAX_PAGES));
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Başka origin (API, OAuth, CDN) ve API benzeri yollar: tarayıcıya bırak
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  // RSC/prefetch istekleri oturuma göre değişir; önbelleğe alınmaz
  if (request.headers.get('RSC') || url.searchParams.has('_rsc')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isStaticAsset(url)) event.respondWith(cacheFirst(request));
});
