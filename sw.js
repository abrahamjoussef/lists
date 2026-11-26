// Service worker: lets Shared Lists install to the home screen and open offline.
// List data itself is kept offline by Firestore's own local cache (persistentLocalCache in app.js);
// this file only caches the app's files so the page can load without a connection.
// When you bump ?v= in index.html, bump VERSION here too so old files are cleared.
const VERSION = 'v29';
const CACHE = 'lists-' + VERSION;
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

const APP_SHELL = [
  './',
  'index.html',
  'styles.css?v=29',
  'app.js?v=29',
  'i18n.js?v=29',
  'types.js?v=29',
  'logic.js?v=29',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];
const CDN = [FB + 'firebase-app.js', FB + 'firebase-firestore.js', FB + 'firebase-auth.js'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    // CDN files are cached on a best-effort basis so a flaky network can't block install
    await Promise.all(CDN.map(u => cache.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('lists-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isFont = url => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
const isFirebaseLib = url => url.href.startsWith('https://www.gstatic.com/firebasejs/');

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Pages: try the network first so updates show up, fall back to the cached app when offline
  if (req.mode === 'navigate' && sameOrigin) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !url.pathname.includes('/about/')) (await caches.open(CACHE)).put('index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  // Firebase library files are versioned in the URL, so the cached copy is always right
  if (isFirebaseLib(url)) { event.respondWith(cacheFirst(req)); return; }

  // App files and fonts: answer from the cache at once, refresh it in the background
  // (skip video and the about/ pages, which aren't needed offline)
  if ((sameOrigin && !url.pathname.includes('/about/') && !/\.(mp4|webm)$/.test(url.pathname)) || isFont(url)) {
    event.respondWith(staleWhileRevalidate(req, event));
  }
  // Everything else (Firestore, sign-in) goes straight to the network as usual
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  });
  if (hit) { event.waitUntil(update.catch(() => {})); return hit; }
  return update;
}
