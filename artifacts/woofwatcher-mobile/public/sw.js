/*
 * WoofWatcher web service worker - offline shell for the installed PWA.
 *
 * The app is local-first (care data lives in localStorage), so the only thing
 * standing between the installed web app and full offline use is the static
 * shell. Strategy, matched to how Expo exports the site:
 *  - navigations: network-first, falling back to the cached shell offline
 *  - /_expo/ + /assets/ bundles: cache-first (filenames are content-hashed,
 *    so a cached copy is immutable by construction)
 *  - explicitly public root assets: stale-while-revalidate
 *  - every other same-origin GET: no-store network (never runtime cached)
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
const RESET_FENCE_CACHE = "woofwatcher-reset-fence-v1";
const RESET_FENCE_ENTRY = "/__woofwatcher_local_reset_epoch__";
const RUNTIME_CACHE_LOCK_NAME = "woofwatcher-runtime-cache.v1";
const SHELL_URLS = ["/", "/manifest.json", "/icon.png", "/favicon.ico", ...EXTRA_SHELL_URLS];
const PUBLIC_RUNTIME_PATHS = new Set(["/manifest.json", "/icon.png", "/favicon.ico"]);

let runtimeCacheGeneration = 0;
let runtimeCacheWritesBlocked = false;
let activeCacheClear = null;
const runtimeCacheWrites = new Set();

function runtimeCacheLockManager() {
  const manager = self.navigator?.locks;
  return manager && typeof manager.request === "function" ? manager : null;
}

function runWithRuntimeCacheLock(operation) {
  const manager = runtimeCacheLockManager();
  return manager
    ? manager.request(
        RUNTIME_CACHE_LOCK_NAME,
        { mode: "exclusive" },
        operation,
      )
    : operation();
}

function parseResetEpoch(raw) {
  if (raw === null) return 0;
  if (!/^(?:0|[1-9]\d{0,14})$/.test(raw)) {
    throw new Error("the service-worker reset epoch is invalid");
  }
  const epoch = Number(raw);
  if (!Number.isSafeInteger(epoch)) {
    throw new Error("the service-worker reset epoch is invalid");
  }
  return epoch;
}

async function readResetEpoch() {
  const fence = await caches.open(RESET_FENCE_CACHE);
  const response = await fence.match(RESET_FENCE_ENTRY);
  return parseResetEpoch(response ? await response.text() : null);
}

async function advanceResetEpoch() {
  const current = await readResetEpoch();
  const next = current + 1;
  if (!Number.isSafeInteger(next)) {
    throw new Error("the service-worker reset epoch is exhausted");
  }
  const fence = await caches.open(RESET_FENCE_CACHE);
  await fence.put(RESET_FENCE_ENTRY, new Response(String(next)));
  if ((await readResetEpoch()) !== next) {
    throw new Error("the service-worker reset epoch was not saved");
  }
  return next;
}

function captureResetEpoch() {
  return runWithRuntimeCacheLock(readResetEpoch);
}

async function putRuntimeResponse(
  request,
  response,
  requestGeneration,
  requestResetEpoch,
) {
  if (
    runtimeCacheWritesBlocked ||
    requestGeneration !== runtimeCacheGeneration
  ) {
    return;
  }

  const write = (async () => {
    // Without an origin-wide lock, runtime caching fails closed. Network and
    // precached-shell behavior still work, but another worker cannot race a
    // privacy reset by recreating a runtime cache.
    if (!runtimeCacheLockManager()) return;
    await runWithRuntimeCacheLock(async () => {
      if (
        runtimeCacheWritesBlocked ||
        requestGeneration !== runtimeCacheGeneration ||
        requestResetEpoch !== (await readResetEpoch())
      ) {
        return;
      }
      const cache = await caches.open(RUNTIME_CACHE);
      if (
        runtimeCacheWritesBlocked ||
        requestGeneration !== runtimeCacheGeneration
      ) {
        return;
      }
      await cache.put(request, response.clone());
    });
  })().catch(() => undefined);
  runtimeCacheWrites.add(write);
  try {
    await write;
  } finally {
    runtimeCacheWrites.delete(write);
  }
}

async function drainRuntimeCacheWrites() {
  while (runtimeCacheWrites.size > 0) {
    await Promise.all([...runtimeCacheWrites]);
  }
}

function clearLocalDataCaches() {
  if (activeCacheClear) return activeCacheClear;

  const operation = (async () => {
    runtimeCacheWritesBlocked = true;
    runtimeCacheGeneration += 1;
    try {
      await drainRuntimeCacheWrites();
      await runWithRuntimeCacheLock(async () => {
        await advanceResetEpoch();
        const keys = await caches.keys();
        const owned = keys.filter(
          (key) =>
            key.startsWith("woofwatcher-") &&
            key !== SHELL_CACHE &&
            key !== RESET_FENCE_CACHE,
        );
        const results = await Promise.all(
          owned.map((key) => caches.delete(key)),
        );
        if (results.some((deleted) => !deleted)) {
          throw new Error("one or more WoofWatcher caches could not be deleted");
        }
      });
    } finally {
      // Requests that began while reset was blocked are stale too. Advancing
      // again before reopening admission prevents their delayed responses from
      // repopulating an owned cache after the reset acknowledgement.
      runtimeCacheGeneration += 1;
      runtimeCacheWritesBlocked = false;
    }
  })();
  activeCacheClear = operation;
  void operation.then(
    () => {
      if (activeCacheClear === operation) activeCacheClear = null;
    },
    () => {
      if (activeCacheClear === operation) activeCacheClear = null;
    },
  );
  return operation;
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
            .filter(
              (key) =>
                key !== SHELL_CACHE &&
                key !== RUNTIME_CACHE &&
                key !== RESET_FENCE_CACHE,
            )
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
  const requestGeneration = runtimeCacheGeneration;
  const requestResetEpoch = await captureResetEpoch();
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    await putRuntimeResponse(
      request,
      fresh,
      requestGeneration,
      requestResetEpoch,
    );
  }
  return fresh;
}

async function staleWhileRevalidate(request) {
  const requestGeneration = runtimeCacheGeneration;
  const requestResetEpoch = await captureResetEpoch();
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (fresh) => {
      if (fresh && fresh.ok) {
        await putRuntimeResponse(
          request,
          fresh,
          requestGeneration,
          requestResetEpoch,
        );
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
  if (PUBLIC_RUNTIME_PATHS.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  event.respondWith(fetch(request, { cache: "no-store" }));
});
