/**
 * sw.js
 * Service Worker untuk caching aset statis agar aplikasi dapat berjalan offline.
 */
const CACHE_NAME = "liftforge-cache-v1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/style.css",
  "./js/storage.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/app.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

// Tahap Install: simpan aset statis ke cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Tahap Activate: bersihkan cache versi lama jika ada pembaruan
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Tahap Fetch: utamakan cache (Cache-First), lalu fallback ke jaringan & simpan ke cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable"
          });
        });
    })
  );
});
