const CACHE = 'fraction-calculator-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/bootstrap.min.css',
  './css/bootstrap-icons.min.css',
  './css/calculator.css',
  './css/fonts/bootstrap-icons.woff',
  './css/fonts/bootstrap-icons.woff2',
  './js/app.js',
  './js/bootstrap.bundle.min.js',
  './js/fraction-calculator-controller.js',
  './js/stimulus.js',
  './icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
