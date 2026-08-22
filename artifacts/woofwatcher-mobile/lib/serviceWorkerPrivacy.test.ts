import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

function loadServiceWorker(
  overrides: {
    match?: (request: unknown) => Promise<unknown>;
    fetch?: (request: unknown, options?: unknown) => Promise<unknown>;
    keys?: () => Promise<string[]>;
    delete?: (name: string) => Promise<boolean>;
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
  const caches = {
    async open(name: string) {
      opened.push(name);
      return {
        async addAll() {},
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
