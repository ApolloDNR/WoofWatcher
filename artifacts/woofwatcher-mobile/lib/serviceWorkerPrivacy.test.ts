import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

function loadServiceWorker(
  overrides: {
    match?: (request: unknown) => Promise<unknown>;
    fetch?: (request: unknown, options?: unknown) => Promise<unknown>;
    open?: (name: string) => Promise<{
      addAll(urls: string[]): Promise<void>;
      put(request: unknown, response: unknown): Promise<void>;
    }>;
    keys?: () => Promise<string[]>;
    delete?: (name: string) => Promise<boolean>;
    locks?: {
      request<T>(
        name: string,
        options: { mode: "exclusive" },
        callback: () => Promise<T>,
      ): Promise<T>;
    } | null;
    fenceState?: { value: string | null };
  } = {},
) {
  const listeners = new Map<string, (event: any) => void>();
  const opened: string[] = [];
  const fetches: Array<{ request: unknown; options: unknown }> = [];
  const deleted: string[] = [];
  const source = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "public", "sw.js"),
    "utf8",
  );
  const fenceState = overrides.fenceState ?? { value: null };
  let lockTail = Promise.resolve();
  const defaultLocks = {
    request<T>(
      _name: string,
      _options: { mode: "exclusive" },
      callback: () => Promise<T>,
    ): Promise<T> {
      const request = lockTail.then(callback);
      lockTail = request.then(
        () => {},
        () => {},
      );
      return request;
    },
  };
  const caches = {
    async open(name: string) {
      opened.push(name);
      if (name === "woofwatcher-reset-fence-v1") {
        return {
          async addAll() {},
          async match() {
            return fenceState.value === null
              ? undefined
              : {
                  async text() {
                    return fenceState.value!;
                  },
                };
          },
          async put(_request: unknown, response: unknown) {
            fenceState.value = await (response as { text(): Promise<string> }).text();
          },
        };
      }
      if (overrides.open) return overrides.open(name);
      return {
        async addAll() {},
        async match() {
          return undefined;
        },
        async put() {},
      };
    },
    keys: overrides.keys ?? (async () => []),
    async delete(name: string) {
      deleted.push(name);
      return overrides.delete ? overrides.delete(name) : true;
    },
    match: overrides.match ?? (async () => undefined),
  };
  const context = {
    URL,
    Response,
    caches,
    fetch: async (request: unknown, options?: unknown) => {
      fetches.push({ request, options });
      return overrides.fetch?.(request, options);
    },
    self: {
      location: { origin: "https://woofwatcher.test" },
      navigator: {
        locks: overrides.locks === null
          ? undefined
          : (overrides.locks ?? defaultLocks),
      },
      clients: { async claim() {} },
      async skipWaiting() {},
      addEventListener(type: string, listener: (event: any) => void) {
        listeners.set(type, listener);
      },
    },
  };
  vm.runInNewContext(source, context, { filename: "public/sw.js" });
  return { listeners, opened, fetches, deleted };
}

test("same-origin API GETs always use no-store network and never a cached response", async () => {
  const cached = {
    source: "cached",
    clone() {
      return this;
    },
  };
  const fresh = {
    source: "fresh",
    ok: true,
    clone() {
      return this;
    },
  };
  const harness = loadServiceWorker({
    match: async () => cached,
    fetch: async () => fresh,
  });
  let responsePromise: Promise<unknown> | null = null;
  harness.listeners.get("fetch")?.({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://woofwatcher.test/api/care-state",
    },
    respondWith(value: Promise<unknown>) {
      responsePromise = value;
    },
  });

  assert.ok(responsePromise);
  assert.equal(await responsePromise, fresh);
  assert.equal(harness.fetches.length, 1);
  assert.equal(
    (harness.fetches[0]?.request as { url?: string }).url,
    "https://woofwatcher.test/api/care-state",
  );
  assert.equal(
    (harness.fetches[0]?.options as { cache?: string }).cache,
    "no-store",
  );
  assert.deepEqual(harness.opened, []);
});

test("unrecognized same-origin GETs bypass runtime caches so provider responses cannot become offline assets", async () => {
  const fresh = {
    source: "private-provider-response",
    ok: true,
    clone() {
      return this;
    },
  };
  const harness = loadServiceWorker({
    match: async () => {
      throw new Error("private routes must not inspect CacheStorage");
    },
    fetch: async () => fresh,
  });
  let responsePromise: Promise<unknown> | null = null;
  harness.listeners.get("fetch")?.({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://woofwatcher.test/__clerk/v1/client",
    },
    respondWith(value: Promise<unknown>) {
      responsePromise = value;
    },
  });

  assert.ok(responsePromise);
  assert.equal(await responsePromise, fresh);
  assert.equal(harness.fetches.length, 1);
  assert.equal(
    (harness.fetches[0]?.options as { cache?: string }).cache,
    "no-store",
  );
  assert.deepEqual(harness.opened, []);
});

test("reset message clears only app runtime/data caches and preserves the current offline shell", async () => {
  const harness = loadServiceWorker({
    keys: async () => [
      "woofwatcher-shell-__BUILD__",
      "woofwatcher-shell-old",
      "woofwatcher-runtime-__BUILD__",
      "woofwatcher-data-v1",
      "unrelated-cache",
    ],
  });
  const messageListener = harness.listeners.get("message");
  assert.ok(messageListener, "service worker must own reset-cache messages");
  let response: unknown;
  let lifetime: Promise<unknown> | null = null;
  const completed = new Promise<void>((resolve) => {
    messageListener({
      data: { type: "woofwatcher:clear-local-data" },
      waitUntil(value: Promise<unknown>) {
        lifetime = value;
      },
      ports: [
        {
          postMessage(value: unknown) {
            response = value;
            resolve();
          },
        },
      ],
    });
  });
  assert.ok(
    lifetime,
    "cache deletion and its acknowledgement must extend worker lifetime",
  );
  await lifetime;
  await completed;

  assert.equal(
    (response as { type?: string }).type,
    "woofwatcher:clear-local-data:complete",
  );
  assert.deepEqual(harness.deleted, [
    "woofwatcher-shell-old",
    "woofwatcher-runtime-__BUILD__",
    "woofwatcher-data-v1",
  ]);
});

test("a fetch started before reset cannot recreate the runtime cache after reset acknowledgement", async () => {
  const cacheNames = new Set<string>();
  const puts: string[] = [];
  let signalFetchStarted!: () => void;
  let resolveFetch!: (response: unknown) => void;
  const fetchStarted = new Promise<void>((resolve) => {
    signalFetchStarted = resolve;
  });
  const fetchResponse = new Promise<unknown>((resolve) => {
    resolveFetch = resolve;
  });
  const harness = loadServiceWorker({
    fetch: async () => {
      signalFetchStarted();
      return fetchResponse;
    },
    open: async (name) => {
      cacheNames.add(name);
      return {
        async addAll() {},
        async put(request) {
          puts.push((request as { url?: string }).url ?? "unknown");
        },
      };
    },
    keys: async () => [...cacheNames],
    delete: async (name) => cacheNames.delete(name),
  });

  let responsePromise: Promise<unknown> | null = null;
  harness.listeners.get("fetch")?.({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://woofwatcher.test/_expo/late.js",
    },
    respondWith(value: Promise<unknown>) {
      responsePromise = value;
    },
  });
  assert.ok(responsePromise);
  await fetchStarted;
  assert.equal(harness.fetches.length, 1, "the pre-reset fetch is in flight");

  let resetLifetime: Promise<unknown> | null = null;
  let acknowledgement: unknown;
  harness.listeners.get("message")?.({
    data: { type: "woofwatcher:clear-local-data" },
    waitUntil(value: Promise<unknown>) {
      resetLifetime = value;
    },
    ports: [
      {
        postMessage(value: unknown) {
          acknowledgement = value;
        },
      },
    ],
  });
  assert.ok(resetLifetime);
  await resetLifetime;
  assert.equal(
    (acknowledgement as { type?: string }).type,
    "woofwatcher:clear-local-data:complete",
  );

  resolveFetch({
    ok: true,
    clone() {
      return this;
    },
  });
  await responsePromise;
  await Promise.resolve();

  assert.deepEqual(puts, []);
  assert.equal(cacheNames.has("woofwatcher-runtime-__BUILD__"), false);
});

test("a fetch in an older worker instance cannot recreate runtime cache after a newer worker acknowledges reset", async () => {
  const cacheNames = new Set<string>();
  const fenceState = { value: null as string | null };
  const puts: string[] = [];
  let lockTail = Promise.resolve();
  const locks = {
    request<T>(
      _name: string,
      _options: { mode: "exclusive" },
      callback: () => Promise<T>,
    ): Promise<T> {
      const request = lockTail.then(callback);
      lockTail = request.then(
        () => {},
        () => {},
      );
      return request;
    },
  };
  let signalFetchStarted!: () => void;
  let resolveFetch!: (response: unknown) => void;
  const fetchStarted = new Promise<void>((resolve) => {
    signalFetchStarted = resolve;
  });
  const fetchResponse = new Promise<unknown>((resolve) => {
    resolveFetch = resolve;
  });
  const shared = {
    locks,
    fenceState,
    open: async (name: string) => {
      cacheNames.add(name);
      return {
        async addAll() {},
        async put(request: unknown) {
          puts.push((request as { url?: string }).url ?? "unknown");
          cacheNames.add(name);
        },
      };
    },
    keys: async () => [...cacheNames],
    delete: async (name: string) => cacheNames.delete(name),
  };
  const olderWorker = loadServiceWorker({
    ...shared,
    fetch: async () => {
      signalFetchStarted();
      return fetchResponse;
    },
  });
  const newerWorker = loadServiceWorker(shared);

  let responsePromise: Promise<unknown> | null = null;
  olderWorker.listeners.get("fetch")?.({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://woofwatcher.test/_expo/older-worker-late.js",
    },
    respondWith(value: Promise<unknown>) {
      responsePromise = value;
    },
  });
  assert.ok(responsePromise);
  await fetchStarted;

  let resetLifetime: Promise<unknown> | null = null;
  let acknowledgement: unknown;
  newerWorker.listeners.get("message")?.({
    data: { type: "woofwatcher:clear-local-data" },
    waitUntil(value: Promise<unknown>) {
      resetLifetime = value;
    },
    ports: [
      {
        postMessage(value: unknown) {
          acknowledgement = value;
        },
      },
    ],
  });
  assert.ok(resetLifetime);
  await resetLifetime;
  assert.equal(
    (acknowledgement as { type?: string }).type,
    "woofwatcher:clear-local-data:complete",
  );

  resolveFetch({
    ok: true,
    clone() {
      return this;
    },
  });
  await responsePromise;
  await Promise.resolve();

  assert.deepEqual(puts, []);
  assert.equal(cacheNames.has("woofwatcher-runtime-__BUILD__"), false);
});

test("reset acknowledgement waits for an already-started runtime cache write before deleting caches", async () => {
  const cacheNames = new Set<string>();
  const events: string[] = [];
  let signalPutStarted!: () => void;
  let finishPut!: () => void;
  const putStarted = new Promise<void>((resolve) => {
    signalPutStarted = resolve;
  });
  const putMayFinish = new Promise<void>((resolve) => {
    finishPut = resolve;
  });
  const harness = loadServiceWorker({
    fetch: async () => ({
      ok: true,
      clone() {
        return this;
      },
    }),
    open: async (name) => {
      cacheNames.add(name);
      return {
        async addAll() {},
        async put() {
          events.push("put:start");
          signalPutStarted();
          await putMayFinish;
          events.push("put:complete");
          cacheNames.add(name);
        },
      };
    },
    keys: async () => [...cacheNames],
    delete: async (name) => {
      events.push(`delete:${name}`);
      return cacheNames.delete(name);
    },
  });

  let responsePromise: Promise<unknown> | null = null;
  harness.listeners.get("fetch")?.({
    request: {
      method: "GET",
      mode: "cors",
      url: "https://woofwatcher.test/_expo/in-flight.js",
    },
    respondWith(value: Promise<unknown>) {
      responsePromise = value;
    },
  });
  assert.ok(responsePromise);
  await putStarted;

  let acknowledged = false;
  let resetLifetime: Promise<unknown> | null = null;
  harness.listeners.get("message")?.({
    data: { type: "woofwatcher:clear-local-data" },
    waitUntil(value: Promise<unknown>) {
      resetLifetime = value;
    },
    ports: [
      {
        postMessage() {
          events.push("acknowledge");
          acknowledged = true;
        },
      },
    ],
  });
  assert.ok(resetLifetime);
  await Promise.resolve();
  await Promise.resolve();

  try {
    assert.equal(
      acknowledged,
      false,
      "reset must not acknowledge while a prior runtime-cache put can still finish",
    );
  } finally {
    finishPut();
  }

  await responsePromise;
  await resetLifetime;
  assert.deepEqual(events, [
    "put:start",
    "put:complete",
    "delete:woofwatcher-runtime-__BUILD__",
    "acknowledge",
  ]);
  assert.equal(cacheNames.has("woofwatcher-runtime-__BUILD__"), false);
});
