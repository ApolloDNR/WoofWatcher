const CACHE_NAME = "woofwatcher-v1";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/styles.css",
  "/src/app.js",
  "/src/woof-core.js",
  "/manifest.webmanifest",
  "/public/app-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(JSON.stringify({ configured: false, mode: "local" }), {
            status: 503,
            headers: { "Content-Type": "application/json; charset=utf-8" }
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || caches.match(event.request.mode === "navigate" ? "/offline.html" : "/"))
      )
  );
});
