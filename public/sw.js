// Service worker: makes the app open instantly and work offline.
//  - /api/*          never touched (live business data; the app keeps its own local copy in IndexedDB)
//  - hashed chunks, fonts, icons   cache-first (they never change under the same URL)
//  - index.html, app.js, css, manifest   network-first with a short timeout, cache as fallback, so a slow
//    connection never blocks start-up but a good connection always picks up a new deploy
const VERSION = 'v4';
const CORE = 'dk-core-' + VERSION;
const STATIC = 'dk-static-' + VERSION;
const PRECACHE = ['/', '/index.html', '/boot.js', '/css/app.css', '/dist/app.js', '/favicon.svg', '/manifest.webmanifest',
  '/fonts/inter-latin-wght-normal.woff2', '/fonts/inter-latin-ext-wght-normal.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const core = await caches.open(CORE);
    await Promise.allSettled(PRECACHE.map((u) => core.add(u)));
    try {
      const m = await (await fetch('/dist/manifest.json', { cache: 'no-store' })).json();
      const st = await caches.open(STATIC);
      await Promise.allSettled(m.files.filter((f) => f.includes('/chunks/')).map((f) => st.add(f)));
    } catch { /* offline install: chunks are cached as they are used */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CORE && k !== STATIC) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isImmutable = (p) => p.startsWith('/dist/chunks/') || p.startsWith('/fonts/') || p === '/favicon.svg';

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}
function networkFirst(req, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = async () => (await caches.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' ? (await caches.match('/')) || (await caches.match('/index.html')) : null);
    const timer = setTimeout(async () => { const hit = await fromCache(); if (hit && !settled) { settled = true; resolve(hit); } }, ms);
    fetch(req).then(async (res) => {
      clearTimeout(timer);
      if (res.ok && res.type === 'basic') (await caches.open(CORE)).put(req, res.clone());
      if (!settled) { settled = true; resolve(res); }
    }).catch(async () => {
      clearTimeout(timer);
      const hit = await fromCache();
      if (!settled) { settled = true; resolve(hit || Response.error()); }
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (isImmutable(url.pathname)) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req, 2500));
});
