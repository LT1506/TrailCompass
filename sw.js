// sw.js — service worker for offline use on the trail.
// IMPORTANT: NETWORK-FIRST. The Meta glasses load the app live from its URL and
// have NO reload button; a cache-first worker would pin stale code forever (this
// bit RangeHUD). So we always try the network, fall back to cache only offline.

var CACHE = 'trailcompass-v1';
var ASSETS = [
  './',
  'index.html',
  'style.css',
  'compass.js',
  'declination.js',
  'sensor.js',
  'location.js',
  'storage.js',
  'platform.js',
  'app.js',
  'manifest.webmanifest',
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) { if (k !== CACHE) return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        // Refresh the cache copy with what we just fetched.
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(e.request); // offline fallback
      })
  );
});
