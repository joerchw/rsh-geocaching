// Caches the app shell so the app loads offline. Map tiles stay online (network).
const CACHE_NAME = 'rsh-geocaching-v9';
const APP_SHELL = [
  '.',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/caches.js',
  'js/codeword.js',
  'js/geo.js',
  'js/rules.js',
  'js/progress.js',
  'js/location.js',
  'js/map.js',
  'js/detail.js',
  'data/caches.json',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'manifest.webmanifest',
  'img/icon-192.png',
  'img/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache map tiles — always go to network.
  if (url.hostname.endsWith('tile.openstreetmap.org')) return;

  // App shell: cache-first, fall back to network.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
