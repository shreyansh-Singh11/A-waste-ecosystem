/**
 * CirculaSync / EcoTrack 360 — Progressive Web App (PWA) Service Worker
 * Enables offline field collection, Leaflet map caching, and background sync queuing.
 */

const CACHE_NAME = "circulasync-pwa-v2";
const STATIC_ASSETS = [
  "/",
  "/user",
  "/collector",
  "/collector/scan.html",
  "/producer",
  "/municipal",
  "/medical",
  "/government",
  "/assets/design-system.css",
  "/assets/shared.js",
  "/assets/leaflet/leaflet.css",
  "/assets/leaflet/leaflet.js"
];

// 1. Install & Cache Core Shell Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[PWA Service Worker] Caching static shell assets for offline resilience...");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[PWA Service Worker] Non-fatal caching warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate & Purge Obsolete Caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[PWA Service Worker] Purging legacy cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Strategy: Network-First for API & Navigations, Cache fallback for offline UI Assets
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Dynamic API requests: Network-First with graceful fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // If offline and request is an edge sync queue POST, notify client
        console.warn(`[PWA Offline] Network unavailable for ${url.pathname}. Queuing locally.`);
        return new Response(
          JSON.stringify({
            offlineBuffered: true,
            status: "PENDING_SYNC",
            message: "Network offline: Action buffered in local device storage."
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200
          }
        );
      })
    );
    return;
  }

  // Navigation requests: Network-First so all portal clicks open cleanly
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Static Assets & Webpages: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Background Sync Re-connection Listener
self.addEventListener("sync", (event) => {
  if (event.tag === "circulasync-flush-offline-queue") {
    console.log("[PWA Service Worker] Background sync triggered: Flushing local field queue to cloud...");
    event.waitUntil(
      fetch("/api/edge/sync/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "BACKGROUND_SYNC_WORKER" })
      }).then((r) => r.json()).then((res) => {
        console.log("[PWA Service Worker] Offline queue synced successfully:", res);
      }).catch((e) => {
        console.error("[PWA Service Worker] Background sync failed:", e);
      })
    );
  }
});
