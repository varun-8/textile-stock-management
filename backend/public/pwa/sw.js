const CACHE_NAME = 'sl-scanner-v2';
const ASSETS_TO_CACHE = [
    '/pwa/',
    '/pwa/index.html',
    '/pwa/manifest.json',
    '/pwa/logo.svg',
    '/pwa/pwa-192x192.svg',
    '/pwa/pwa-512x512.svg'
];

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.warn('Cache add failed:', err);
                // Continue even if some assets fail to cache
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip API calls - always use network
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // App-shell fallback for SPA routes under /pwa/*
    const reqUrl = new URL(event.request.url);
    if (event.request.mode === 'navigate' && reqUrl.pathname.startsWith('/pwa')) {
        event.respondWith(
            caches.match('/pwa/index.html').then(cached => cached || fetch('/pwa/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            // Return cached response if available
            if (response) {
                return response;
            }

            // Try network request
            return fetch(event.request).then(response => {
                // Don't cache non-successful responses
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }

                // Clone the response
                const responseToCache = response.clone();

                // Cache successful responses
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            }).catch(() => {
                // Network request failed, serve from cache or offline page
                return caches.match(event.request);
            });
        })
    );
});
