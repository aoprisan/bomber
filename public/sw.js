/*
 * Service worker: keeps Night Raid installable and playable offline without
 * ever stranding a returning visitor on a stale shell.
 *
 * Strategy:
 *   - Navigations (the HTML document): NETWORK-FIRST. Always fetch the current
 *     index.html when online so it references the current hashed bundles;
 *     fall back to the cached shell only when offline. This is the crucial
 *     fix: a cache-first document could keep pointing at fingerprinted asset
 *     files that a newer deploy has since deleted from the server -> 404 ->
 *     blank page.
 *   - Fingerprinted assets (immutable): CACHE-FIRST, populated at runtime.
 *   - Bumping VERSION sweeps every older cache on activate.
 */
const VERSION = "night-raid-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documents: network-first so the app always boots the latest build online.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(VERSION).then((cache) => cache.put("./index.html", clone));
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("./index.html"))),
    );
    return;
  }

  // Fingerprinted assets: cache-first, fall back to network (and cache it).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => Response.error());
    }),
  );
});
