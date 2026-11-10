// Virtual Museum Service Worker - Cache-First Static Asset Vault
const CACHE_NAME = 'virtual-museum-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Intercept requests for static assets, textures, models, audio, fonts, and data JSONs
  const isMuseumAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.glb') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.webm');

  if (!isMuseumAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // Check CacheStorage first (0ms disk hit)
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not cached, fetch from network and store in cache
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        return cachedResponse || Promise.reject(err);
      }
    })
  );
});

