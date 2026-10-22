/* KEFE service worker.
 *
 * Network-first for same-origin GET requests, with a runtime cache as the
 * offline fallback. Network-first keeps deploys and the ?v= cache-busted
 * script/style URLs authoritative: online users always get the live files,
 * and the cache only answers when the network is unavailable.
 *
 * Deliberately not intercepted: non-GET requests, cross-origin requests
 * (song search, artwork and lyrics services) and Range requests (audio and
 * video seeking), which all go straight to the network.
 */
const CACHE = 'kefe-shell-v2';

const PRECACHE = [
  './editor.html',
  './manifest.webmanifest',
  './app/brand/favicon.svg',
  './app/brand/icon-192.png',
  './app/brand/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Content-hashed bundles and vendored fonts never change under the same URL: serve them from cache instantly.
  if (/\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css|woff2?|png|svg|webmanifest)$/.test(url.pathname) || /\/fonts\/.+\.woff2$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./editor.html');
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') cache.put(request, response.clone()).catch(() => {});
  return response;
}
