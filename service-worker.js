const STUDYDECK_CACHE = 'studydeck-preview-20260619201957';
const STUDYDECK_ASSETS = [
  "./",
  "./app.js",
  "./assets/maps/geography-bible-atlas-v1.svg",
  "./assets/maps/geography-galilee-inset-v1.svg",
  "./assets/maps/geography-israel-inset-v1.svg",
  "./assets/maps/geography-world-overview-v1.svg",
  "./assets/studydeck-icon-180.png",
  "./assets/studydeck-icon-192.png",
  "./assets/studydeck-icon-512.png",
  "./assets/studydeck-icon.svg",
  "./js/studydeck-guided-author-qa.js",
  "./js/studydeck-guided-author-sidecars.js",
  "./js/studydeck-guided-map-authoring.js",
  "./js/studydeck-guided-maps.js",
  "./js/studydeck-persistence.js",
  "./js/studydeck-rewards.js",
  "./js/studydeck-timeline-pilot-sidecar.js",
  "./js/studydeck-timelines.js",
  "./manifest.json",
  "./preview-data.js",
  "./preview-summary.json",
  "./styles.css"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STUDYDECK_CACHE).then(cache => cache.addAll(STUDYDECK_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('studydeck-preview-') && key !== STUDYDECK_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(STUDYDECK_CACHE).then(cache => cache.put('./', copy));
      return response;
    }).catch(() => caches.match('./').then(response => response || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (!response || response.status !== 200 || response.type === 'opaque') return response;
    const copy = response.clone();
    caches.open(STUDYDECK_CACHE).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
