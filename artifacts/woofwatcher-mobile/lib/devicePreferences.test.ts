import assert from "node:assert/strict";
import { test } from "node:test";

import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import {
  DEVICE_PREFERENCE_KEYS,
  DEVICE_PREFERENCE_RESET_KEYS,
  HOME_WELCOME_DISMISSED_KEY,
  LEGACY_PWA_THEME_KEY,
  MOBILE_QA_SESSION_STORAGE_KEY,
  PACK_SUPPLIES_KEY,
  TRAVEL_BAG_KEY,
  createDevicePreferencesStore,
  type DevicePreferenceKey,
} from "./devicePreferences.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createMemoryStorage(initial: Readonly<Record<string, string>> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async drain() {},
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

test("owns exact frozen normal and destructive device-preference manifests", () => {
  assert.equal(
    HOME_WELCOME_DISMISSED_KEY,
    "woofwatcher.homeWelcomeDismissed.v1",
  );
  assert.equal(
    MOBILE_QA_SESSION_STORAGE_KEY,
    "woofwatcher.mobileReleaseQaSession.v1",
  );
  assert.equal(PACK_SUPPLIES_KEY, "woofwatcher.packSupplies.v1");
  assert.equal(TRAVEL_BAG_KEY, "woofwatcher.travelBag.v1");
  assert.equal(LEGACY_PWA_THEME_KEY, "woofwatcher.v1.theme");
  assert.deepEqual(DEVICE_PREFERENCE_KEYS, [
    "woofwatcher.homeWelcomeDismissed.v1",
    "woofwatcher.mobileReleaseQaSession.v1",
    "woofwatcher.packSupplies.v1",
    "woofwatcher.travelBag.v1",
  ]);
  assert.deepEqual(DEVICE_PREFERENCE_RESET_KEYS, [
    "woofwatcher.homeWelcomeDismissed.v1",
    "woofwatcher.mobileReleaseQaSession.v1",
    "woofwatcher.packSupplies.v1",
    "woofwatcher.travelBag.v1",
    "woofwatcher.v1.theme",
  ]);
  assert.equal(Object.isFrozen(DEVICE_PREFERENCE_KEYS), true);
  assert.equal(Object.isFrozen(DEVICE_PREFERENCE_RESET_KEYS), true);
});

test("rejects unknown runtime keys and exposes no normal removal escape hatch", async () => {
  const storage = createMemoryStorage();
  const store = createDevicePreferencesStore(storage);

  assert.deepEqual(Object.keys(store).sort(), ["hydrate", "save"]);
  for (const name of ["remove", "removeItem", "multiRemove", "storage", "raw"] as const) {
    assert.equal(name in store, false, `unexpected store member: ${name}`);
  }

  const unknown = "woofwatcher.unknown.v1" as DevicePreferenceKey;
  await assert.rejects(store.save(unknown, "value"), /unknown device preference key/i);
  await assert.rejects(
    store.hydrate(unknown, {
      isCancelled: () => false,
      apply: () => assert.fail("an unknown key must never apply"),
    }),
    /unknown device preference key/i,
  );
  const resetOnlyKey = LEGACY_PWA_THEME_KEY as DevicePreferenceKey;
  assert.equal(DEVICE_PREFERENCE_KEYS.includes(resetOnlyKey), false);
  await assert.rejects(
    store.save(resetOnlyKey, "dark"),
    /unknown device preference key/i,
  );
  await assert.rejects(
    store.hydrate(resetOnlyKey, {
      isCancelled: () => false,
      apply: () => assert.fail("a reset-only key must never enter normal hydration"),
    }),
    /unknown device preference key/i,
  );
  assert.deepEqual([...storage.values], []);
});

test("hydration drains an already-accepted delayed save before reading its new bytes", async () => {
  const writeRelease = deferred<void>();
  const events: string[] = [];
  let raw = "old";
  let pendingWrite = Promise.resolve();
  const store = createDevicePreferencesStore({
    drain: async () => {
      events.push("drain:start");
      await pendingWrite;
      events.push("drain:finish");
    },
    getItem: async () => {
      events.push(`read:${raw}`);
      return raw;
    },
    setItem: (_key, value) => {
      events.push(`write:start:${value}`);
      pendingWrite = writeRelease.promise.then(() => {
        raw = value;
        events.push(`write:finish:${value}`);
      });
      return pendingWrite;
    },
  });

  const save = store.save(HOME_WELCOME_DISMISSED_KEY, "new");
  const applied: Array<string | null> = [];
  const hydration = store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
    isCancelled: () => false,
    apply: (value) => applied.push(value),
  });
  await Promise.resolve();

  assert.deepEqual(events, ["write:start:new", "drain:start"]);
  writeRelease.resolve();
  assert.deepEqual(await Promise.all([save, hydration]), [undefined, "applied"]);
  assert.deepEqual(events, [
    "write:start:new",
    "drain:start",
    "write:finish:new",
    "drain:finish",
    "read:new",
  ]);
  assert.deepEqual(applied, ["new"]);
});

test("a same-key save admitted during a delayed read rejects the old result and retries", async () => {
  const firstRead = deferred<string | null>();
  let raw = "old";
  let readCount = 0;
  let drainCount = 0;
  const store = createDevicePreferencesStore({
    async drain() {
      drainCount += 1;
    },
    getItem() {
      readCount += 1;
      return readCount === 1 ? firstRead.promise : Promise.resolve(raw);
    },
    async setItem(_key, value) {
      raw = value;
    },
  });
  const applied: Array<string | null> = [];

  const hydration = store.hydrate(PACK_SUPPLIES_KEY, {
    isCancelled: () => false,
    apply: (value) => applied.push(value),
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(readCount, 1);

  await store.save(PACK_SUPPLIES_KEY, "new");
  firstRead.resolve("old");

  assert.equal(await hydration, "applied");
  assert.equal(drainCount, 2);
  assert.equal(readCount, 2);
  assert.deepEqual(applied, ["new"]);
});

test("a same-key save bumps revision before its delayed persistence settles", async () => {
  const firstRead = deferred<string | null>();
  const writeRelease = deferred<void>();
  let raw = "old";
  let pendingWrite: Promise<void> | null = null;
  let readCount = 0;
  const applied: Array<string | null> = [];
  const store = createDevicePreferencesStore({
    async drain() {
      if (pendingWrite) await pendingWrite;
    },
    getItem() {
      readCount += 1;
      return readCount === 1 ? firstRead.promise : Promise.resolve(raw);
    },
    setItem(_key, value) {
      pendingWrite = writeRelease.promise.then(() => {
        raw = value;
      });
      return pendingWrite;
    },
  });

  const hydration = store.hydrate(PACK_SUPPLIES_KEY, {
    isCancelled: () => false,
    apply: (value) => applied.push(value),
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(readCount, 1);

  const save = store.save(PACK_SUPPLIES_KEY, "new");
  firstRead.resolve("old");
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(readCount, 1);
  assert.deepEqual(applied, []);

  writeRelease.resolve();
  assert.deepEqual(await Promise.all([save, hydration]), [undefined, "applied"]);
  assert.equal(readCount, 2);
  assert.deepEqual(applied, ["new"]);
});

test("a stale same-key read failure retries without overwriting a newer optimistic save", async () => {
  const firstRead = deferred<string | null>();
  const staleFailure = new Error("the superseded travel read failed");
  let raw = "old";
  let reads = 0;
  let drains = 0;
  let travelMemory = "old";
  const store = createDevicePreferencesStore({
    async drain() {
      drains += 1;
    },
    getItem() {
      reads += 1;
      return reads === 1 ? firstRead.promise : Promise.resolve(raw);
    },
    async setItem(_key, value) {
      raw = value;
    },
  });

  const hydration = store
    .hydrate(TRAVEL_BAG_KEY, {
      isCancelled: () => false,
      apply: (value) => {
        travelMemory = value ?? "default";
      },
    })
    .catch((error) => {
      travelMemory = "default";
      throw error;
    });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(reads, 1);

  const save = store.save(TRAVEL_BAG_KEY, "new");
  travelMemory = "new";
  firstRead.reject(staleFailure);

  assert.deepEqual(await Promise.all([save, hydration]), [undefined, "applied"]);
  assert.equal(drains, 2);
  assert.equal(reads, 2);
  assert.equal(travelMemory, "new");
});

test("a reentrant same-key save from getItem invalidates the returned old bytes", async () => {
  let raw = "old";
  let reads = 0;
  let store!: ReturnType<typeof createDevicePreferencesStore>;
  const applied: Array<string | null> = [];
  store = createDevicePreferencesStore({
    async drain() {},
    getItem() {
      reads += 1;
      if (reads === 1) {
        void store.save(HOME_WELCOME_DISMISSED_KEY, "new");
        return Promise.resolve("old");
      }
      return Promise.resolve(raw);
    },
    async setItem(_key, value) {
      raw = value;
    },
  });

  const result = await store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
    isCancelled: () => false,
    apply: (value) => applied.push(value),
  });

  assert.equal(result, "applied");
  assert.equal(reads, 2);
  assert.deepEqual(applied, ["new"]);
});

test("a write to one key does not stale an in-flight read for another key", async () => {
  const homeRead = deferred<string | null>();
  let reads = 0;
  const storage = createMemoryStorage();
  const store = createDevicePreferencesStore({
    ...storage,
    getItem(key) {
      reads += 1;
      return key === HOME_WELCOME_DISMISSED_KEY
        ? homeRead.promise
        : Promise.resolve(storage.values.get(key) ?? null);
    },
  });
  const applied: Array<string | null> = [];
  const hydration = store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
    isCancelled: () => false,
    apply: (raw) => applied.push(raw),
  });
  await Promise.resolve();
  await Promise.resolve();

  await store.save(MOBILE_QA_SESSION_STORAGE_KEY, "qa-new");
  homeRead.resolve("home-old");

  assert.equal(await hydration, "applied");
  assert.equal(reads, 1);
  assert.deepEqual(applied, ["home-old"]);
});

test("cancellation before drain settles causes zero apply", async () => {
  const drain = deferred<void>();
  let cancelled = true;
  let applies = 0;
  const store = createDevicePreferencesStore({
    drain: () => drain.promise,
    getItem: async () => "raw",
    setItem: async () => {},
  });

  const hydration = store.hydrate(TRAVEL_BAG_KEY, {
    isCancelled: () => cancelled,
    apply: () => {
      applies += 1;
    },
  });
  drain.resolve();

  assert.equal(await hydration, "cancelled");
  assert.equal(applies, 0);
  cancelled = false;
});

test("cancellation while a read is pending causes zero apply", async () => {
  const read = deferred<string | null>();
  let cancelled = false;
  let applies = 0;
  const store = createDevicePreferencesStore({
    drain: async () => {},
    getItem: () => read.promise,
    setItem: async () => {},
  });

  const hydration = store.hydrate(PACK_SUPPLIES_KEY, {
    isCancelled: () => cancelled,
    apply: () => {
      applies += 1;
    },
  });
  await Promise.resolve();
  cancelled = true;
  read.resolve("raw");

  assert.equal(await hydration, "cancelled");
  assert.equal(applies, 0);
});

test("cancellation after storage returns but before apply causes zero apply", async () => {
  let cancelled = false;
  let applies = 0;
  const store = createDevicePreferencesStore({
    drain: async () => {},
    getItem: async () => {
      cancelled = true;
      return "raw";
    },
    setItem: async () => {},
  });

  assert.equal(
    await store.hydrate(MOBILE_QA_SESSION_STORAGE_KEY, {
      isCancelled: () => cancelled,
      apply: () => {
        applies += 1;
      },
    }),
    "cancelled",
  );
  assert.equal(applies, 0);
});

test("reset-in-progress failures from drain and read propagate with zero apply", async () => {
  for (const phase of ["drain", "read"] as const) {
    const failure = new LocalDataResetInProgressError();
    let reads = 0;
    let applies = 0;
    const store = createDevicePreferencesStore({
      drain: async () => {
        if (phase === "drain") throw failure;
      },
      getItem: async () => {
        reads += 1;
        if (phase === "read") throw failure;
        return "raw";
      },
      setItem: async () => {},
    });

    await assert.rejects(
      store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
        isCancelled: () => false,
        apply: () => {
          applies += 1;
        },
      }),
      (error) => error === failure,
    );
    assert.equal(applies, 0);
    assert.equal(reads, phase === "read" ? 1 : 0);
  }
});

test("synchronous adapter throws become rejected store promises", async () => {
  const syncFailure = new Error("synchronous adapter failure");

  for (const phase of ["save", "drain", "read"] as const) {
    const store = createDevicePreferencesStore({
      drain: (() => {
        if (phase === "drain") throw syncFailure;
        return Promise.resolve();
      }) as () => Promise<void>,
      getItem: (() => {
        if (phase === "read") throw syncFailure;
        return Promise.resolve(null);
      }) as (key: string) => Promise<string | null>,
      setItem: (() => {
        if (phase === "save") throw syncFailure;
        return Promise.resolve();
      }) as (key: string, value: string) => Promise<void>,
    });
    let operation!: Promise<unknown>;

    assert.doesNotThrow(() => {
      operation =
        phase === "save"
          ? store.save(HOME_WELCOME_DISMISSED_KEY, "true")
          : store.hydrate(HOME_WELCOME_DISMISSED_KEY, {
              isCancelled: () => false,
              apply: () => assert.fail("a failed adapter must not apply"),
            });
    });
    await assert.rejects(operation, (error) => error === syncFailure);
  }
});
