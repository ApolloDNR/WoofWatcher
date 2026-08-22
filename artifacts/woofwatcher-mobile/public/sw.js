/*
 * WoofWatcher web service worker - offline shell for the installed PWA.
 *
 * The app is local-first (care data lives in localStorage), so the only thing
 * standing between the installed web app and full offline use is the static
 * shell. Strategy, matched to how Expo exports the site:
 *  - navigations: network-first, falling back to the cached shell offline
 *  - /_expo/ + /assets/ bundles: cache-first (filenames are content-hashed,
 *    so a cached copy is immutable by construction)
 *  - other same-origin GETs (icons, fonts): stale-while-revalidate
 * Bumping SHELL_VERSION invalidates old caches on activate.
 */

// Both constants below are rewritten by scripts/smoke-web-export.js at export
// time: the version becomes the entry bundle's content hash (so every deploy
// gets a fresh cache) and the extra URLs are the real hashed bundle paths, so
// the whole app shell is precached at install - offline never depends on the
// browser's heuristic HTTP cache.
const SHELL_VERSION = "__BUILD__";
const EXTRA_SHELL_URLS = [];
const SHELL_CACHE = `woofwatcher-shell-${SHELL_VERSION}`;
const RUNTIME_CACHE = `woofwatcher-runtime-${SHELL_VERSION}`;
const SHELL_URLS = ["/", "/manifest.json", "/icon.png", "/favicon.ico", ...EXTRA_SHELL_URLS];

async function clearLocalDataCaches() {
  const keys = await caches.keys();
  const owned = keys.filter(
    (key) => key.startsWith("woofwatcher-") && key !== SHELL_CACHE,
  );
  const results = await Promise.all(owned.map((key) => caches.delete(key)));
  if (results.some((deleted) => !deleted)) {
    throw new Error("one or more WoofWatcher caches could not be deleted");
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "woofwatcher:clear-local-data") return;
  const reply = event.ports?.[0];
  const operation = clearLocalDataCaches().then(
    () => reply?.postMessage({ type: "woofwatcher:clear-local-data:complete" }),
    () => reply?.postMessage({ type: "woofwatcher:clear-local-data:failed" }),
  );
  event.waitUntil(operation);
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirstShell(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put("/", fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match("/");
    if (cached) return cached;
    throw new Error("offline and no cached shell");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) {
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, fresh.clone()));
      }
      return fresh;
    })
    .catch(() => undefined);
  return cached ?? (await refresh) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }
  if (url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
