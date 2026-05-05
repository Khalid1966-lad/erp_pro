// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO — Service Worker (PWA)
// ═══════════════════════════════════════════════════════════════
//
// UPDATE MECHANISM:
// - The prebuild script generates /public/build-meta.json with a
//   timestamp and version before each build.
// - CACHE_NAME embeds this timestamp so that sw.js itself changes
//   on EVERY build, guaranteeing the browser detects the update.
// - sw.js and build-meta.json are served with Cache-Control: no-cache
//   so the browser always fetches the latest copy from the server.
//
// ═══════════════════════════════════════════════════════════════

// 🔄  AUTO-GENERATED — do not edit CACHE_NAME manually
// Build script writes build-meta.json → sw.js reads it at install time.
// Fallback values are used only if build-meta.json is missing (dev mode).
let CACHE_NAME = 'gema-erp-fallback';
let BUILD_STAMP = 'dev';

const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.webmanifest',
];

// ── Fetch build metadata to determine cache name ──
async function loadBuildMeta() {
  try {
    const res = await fetch('/build-meta.json', { cache: 'no-store' });
    if (!res.ok) return;
    const meta = await res.json();
    CACHE_NAME = meta.cacheName || CACHE_NAME;
    BUILD_STAMP = meta.buildDate || BUILD_STAMP;
    console.log('[PWA] Build meta loaded:', CACHE_NAME, '|', BUILD_STAMP);
  } catch {
    console.warn('[PWA] Could not load build-meta.json, using fallback cache name');
  }
}

// Install: load build meta → set cache name → pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    loadBuildMeta().then(() => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch(() => {
          // Silently fail for individual assets that might not exist
        });
      });
    })
  );
  // Don't skipWaiting here — wait for the client to trigger it
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Listen for SKIP_WAITING message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // API calls: network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses briefly
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful static responses
        if (response.ok && (request.url.includes('/_next/static/') || request.url.includes('/logo'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});
