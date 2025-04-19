// public/serviceWorker.js
const CACHE_NAME = 'remote-radar-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/css/main.chunk.css',
  '/static/js/bundle.js',
  '/static/js/main.chunk.js',
  '/static/js/vendors~main.chunk.js',
  '/manifest.json',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache if possible
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.method !== 'GET') {
    return;
  }

  // Handle API requests - network first, then cache
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response before putting it in cache
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              // Only cache successful responses
              if (responseToCache.status === 200) {
                cache.put(event.request, responseToCache);
              }
            });
            
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // If no cache for API, return a custom offline response
              return new Response(
                JSON.stringify({ 
                  error: 'You are offline and this data is not cached',
                  offline: true 
                }),
                { 
                  headers: { 'Content-Type': 'application/json' },
                  status: 503,
                  statusText: 'Service Unavailable'
                }
              );
            });
        })
    );
    return;
  }
  
  // For static assets and HTML - cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Clone the response
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // Cache successful responses
                if (responseToCache.status === 200) {
                  cache.put(event.request, responseToCache);
                }
              });
              
            return response;
          })
          .catch(error => {
            // Special handling for HTML navigation
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            throw error;
          });
      })
  );
});