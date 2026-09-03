import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SUPPLIES,
  parseSupplies,
  type SupplyItem,
} from "./packSupplies.ts";
import {
  createPackPersistence,
  getPackStorageWarningPresentation,
  prepareMountedPackPersistenceForOwnerWipe,
  PACK_CORRUPT_BACKUP_KEY,
  PACK_RECOVERY_JOURNAL_KEY,
  PACK_SUPPLIES_KEY,
  registerPackPersistenceForOwnerWipe,
  TRAVEL_BAG_KEY,
  type PackKeyValueStorage,
} from "./packPersistence.ts";
import { defaultTravelBag, parseTravelBag } from "./travelBag.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function changedSupplies(status: "low" | "out"): SupplyItem[] {
  return DEFAULT_SUPPLIES.map((item) =>
    item.id === "essentials-food"
      ? { ...item, status, updatedAt: "2026-09-02T12:00:00.000Z" }
      : { ...item },
  );
}

test("a failed read pauses writes instead of exposing defaults that can overwrite saved Pack data", async () => {
  const writes: Array<{ key: string; value: string }> = [];
  const storage: PackKeyValueStorage = {
    getItem: async () => {
      throw new Error("storage temporarily unavailable");
    },
    setItem: async (key, value) => {
      writes.push({ key, value });
    },
  };
  const persistence = createPackPersistence(storage);

  assert.deepEqual(await persistence.hydrate(), { status: "read-failed" });
  await assert.rejects(
    persistence.saveSupplies(changedSupplies("low")),
    /paused until Pack loads successfully/i,
  );
  await assert.rejects(
    persistence.saveTravelBag(defaultTravelBag()),
    /paused until Pack loads successfully/i,
  );
  assert.deepEqual(writes, []);
});

test("a malformed stored payload pauses both Pack stores instead of exposing overwriteable defaults", async () => {
  const writes: Array<{ key: string; value: string }> = [];
  const storage: PackKeyValueStorage = {
    getItem: async (key) => {
      if (key === PACK_SUPPLIES_KEY) {
        return '{"version":1,"items":"not-a-list"}';
      }
      if (key === TRAVEL_BAG_KEY) {
        return JSON.stringify({
            version: 1,
            label: "Weekend trip",
            phase: "active",
            activatedAt: "not-a-date",
            completedAt: null,
          });
      }
      return null;
    },
    setItem: async (key, value) => {
      writes.push({ key, value });
    },
  };
  const persistence = createPackPersistence(storage);

  assert.deepEqual(await persistence.hydrate(), { status: "corrupt-data" });
  await assert.rejects(
    persistence.saveSupplies(changedSupplies("low")),
    /paused until Pack loads successfully/i,
  );
  await assert.rejects(
    persistence.saveTravelBag(defaultTravelBag()),
    /paused until Pack loads successfully/i,
  );
  assert.deepEqual(writes, []);
});

test("owner recovery preserves the exact corrupt Pack payloads before installing fresh defaults", async () => {
  const rawSupplies = '{"version":1,"items":"not-a-list"}';
  const rawTravelBag = '{"version":1,"label":"Old trip","phase":"broken"}';
  const stored = new Map<string, string>([
    [PACK_SUPPLIES_KEY, rawSupplies],
    [TRAVEL_BAG_KEY, rawTravelBag],
  ]);
  const writes: string[] = [];
  const storage: PackKeyValueStorage = {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => {
      writes.push(key);
      stored.set(key, value);
    },
  };
  const persistence = createPackPersistence(
    storage,
    () => "2026-09-03T04:00:00.000Z",
  );

  assert.deepEqual(await persistence.hydrate(), { status: "corrupt-data" });
  const recovered = await persistence.recoverCorruptData();

  assert.equal(recovered.status, "ready");
  assert.deepEqual(writes, [
    PACK_CORRUPT_BACKUP_KEY,
    PACK_RECOVERY_JOURNAL_KEY,
    PACK_SUPPLIES_KEY,
    TRAVEL_BAG_KEY,
  ]);
  assert.deepEqual(JSON.parse(stored.get(PACK_CORRUPT_BACKUP_KEY)!), {
    version: 1,
    capturedAt: "2026-09-03T04:00:00.000Z",
    supplies: rawSupplies,
    travelBag: rawTravelBag,
  });
  assert.deepEqual(parseSupplies(stored.get(PACK_SUPPLIES_KEY)), [
    ...DEFAULT_SUPPLIES,
  ]);
  assert.deepEqual(
    parseTravelBag(stored.get(TRAVEL_BAG_KEY)),
    defaultTravelBag(),
  );
});

test("a recovery retry never overwrites the first exact corrupt Pack backup", async () => {
  const firstBackup = JSON.stringify({
    version: 1,
    capturedAt: "2026-09-02T00:00:00.000Z",
    supplies: "first corrupt supplies",
    travelBag: "first corrupt bag",
  });
  const stored = new Map<string, string>([
    [PACK_SUPPLIES_KEY, "later corrupt supplies"],
    [TRAVEL_BAG_KEY, "later corrupt bag"],
    [PACK_CORRUPT_BACKUP_KEY, firstBackup],
  ]);
  const storage: PackKeyValueStorage = {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => stored.set(key, value),
  };
  const persistence = createPackPersistence(storage);

  assert.deepEqual(await persistence.hydrate(), { status: "corrupt-data" });
  assert.equal((await persistence.recoverCorruptData()).status, "ready");
  assert.equal(stored.get(PACK_CORRUPT_BACKUP_KEY), firstBackup);
});

test("hydrate replays an interrupted two-key Pack recovery before exposing either store", async () => {
  const stored = new Map<string, string>([
    [PACK_SUPPLIES_KEY, '{"version":1,"items":"not-a-list"}'],
    [TRAVEL_BAG_KEY, '{"version":1,"phase":"broken"}'],
  ]);
  let interruptTravelWrite = true;
  const storage: PackKeyValueStorage = {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => {
      if (key === TRAVEL_BAG_KEY && interruptTravelWrite) {
        interruptTravelWrite = false;
        throw new Error("process terminated between Pack writes");
      }
      stored.set(key, value);
    },
    removeItem: async (key) => {
      stored.delete(key);
    },
  };

  const interrupted = createPackPersistence(storage);
  assert.deepEqual(await interrupted.hydrate(), { status: "corrupt-data" });
  assert.deepEqual(await interrupted.recoverCorruptData(), {
    status: "read-failed",
  });
  assert.equal(
    stored.has(PACK_RECOVERY_JOURNAL_KEY),
    true,
    "the intended pair must remain durable after the first key is replaced",
  );

  const relaunched = createPackPersistence(storage);
  const replayed = await relaunched.hydrate();
  assert.equal(replayed.status, "ready");
  if (replayed.status !== "ready") return;
  assert.deepEqual(replayed.supplies, [...DEFAULT_SUPPLIES]);
  assert.deepEqual(replayed.travelBag, defaultTravelBag());
  assert.equal(stored.has(PACK_RECOVERY_JOURNAL_KEY), false);
});

test("a successful first load provides fresh defaults and enables both stores", async () => {
  const stored = new Map<string, string>();
  const storage: PackKeyValueStorage = {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => {
      stored.set(key, value);
    },
  };
  const persistence = createPackPersistence(storage);

  const result = await persistence.hydrate();
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.deepEqual(result.supplies, [...DEFAULT_SUPPLIES]);
  assert.deepEqual(result.travelBag, defaultTravelBag());

  const supplies = changedSupplies("low");
  const bag = { ...defaultTravelBag(), label: "Coast trip" };
  await Promise.all([
    persistence.saveSupplies(supplies),
    persistence.saveTravelBag(bag),
  ]);
  assert.deepEqual(parseSupplies(stored.get(PACK_SUPPLIES_KEY)), supplies);
  assert.deepEqual(parseTravelBag(stored.get(TRAVEL_BAG_KEY)), bag);
});

test("rapid saves are serialized per key so the newest Pack snapshot persists last", async () => {
  const firstWrite = deferred<void>();
  const calls: Array<{ key: string; value: string }> = [];
  const stored = new Map<string, string>();
  const storage: PackKeyValueStorage = {
    getItem: async () => null,
    setItem: async (key, value) => {
      calls.push({ key, value });
      if (calls.length === 1) await firstWrite.promise;
      stored.set(key, value);
    },
  };
  const persistence = createPackPersistence(storage);
  assert.equal((await persistence.hydrate()).status, "ready");

  const older = changedSupplies("low");
  const newest = changedSupplies("out");
  const olderSave = persistence.saveSupplies(older);
  const newestSave = persistence.saveSupplies(newest);
  await Promise.resolve();
  assert.equal(
    calls.length,
    1,
    "the newer write must wait for the older write",
  );

  firstWrite.resolve();
  await Promise.all([olderSave, newestSave]);
  assert.equal(calls.length, 2);
  assert.deepEqual(parseSupplies(stored.get(PACK_SUPPLIES_KEY)), newest);
});

test("a rejected write is reported but does not stall the next queued save or an explicit retry", async () => {
  let attempts = 0;
  let stored: string | undefined;
  const storage: PackKeyValueStorage = {
    getItem: async () => null,
    setItem: async (_key, value) => {
      attempts += 1;
      if (attempts === 1) throw new Error("disk full");
      stored = value;
    },
  };
  const persistence = createPackPersistence(storage);
  assert.equal((await persistence.hydrate()).status, "ready");

  const current = changedSupplies("out");
  await assert.rejects(
    persistence.saveSupplies(changedSupplies("low")),
    /disk full/,
  );
  await persistence.saveSupplies(current);
  assert.equal(attempts, 2);
  assert.deepEqual(parseSupplies(stored), current);
});

test("owner wipe drains the active Pack write and prevents a queued snapshot from restoring deleted data", async () => {
  const firstWrite = deferred<void>();
  const stored = new Map<string, string>();
  const calls: string[] = [];
  const storage: PackKeyValueStorage = {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => {
      calls.push(key);
      if (calls.length === 1) await firstWrite.promise;
      stored.set(key, value);
    },
  };
  const persistence = createPackPersistence(storage);
  assert.equal((await persistence.hydrate()).status, "ready");
  const unregister = registerPackPersistenceForOwnerWipe(persistence);

  const activeSave = persistence.saveSupplies(changedSupplies("low"));
  await Promise.resolve();
  assert.equal(
    calls.length,
    1,
    "the first save must already be inside AsyncStorage",
  );
  const queuedSave = persistence.saveSupplies(changedSupplies("out"));
  const prepared = prepareMountedPackPersistenceForOwnerWipe();
  let preparationFinished = false;
  void prepared.then(() => {
    preparationFinished = true;
  });
  await Promise.resolve();
  assert.equal(
    preparationFinished,
    false,
    "the wipe must wait for the active platform write",
  );

  firstWrite.resolve();
  await activeSave;
  await assert.rejects(queuedSave, /paused until Pack loads successfully/i);
  await prepared;
  stored.clear();
  await Promise.resolve();

  assert.equal(
    calls.length,
    1,
    "a queued pre-wipe snapshot must never reach storage",
  );
  assert.equal(stored.size, 0);
  await assert.rejects(
    persistence.saveTravelBag(defaultTravelBag()),
    /paused until Pack loads successfully/i,
  );
  unregister();
});

test("owner wipe waits for active corrupt-data recovery before deleting Pack keys", async () => {
  const backupWrite = deferred<void>();
  const stored = new Map<string, string>([
    [PACK_SUPPLIES_KEY, '{"version":1,"items":"broken"}'],
    [TRAVEL_BAG_KEY, '{"version":1,"phase":"broken"}'],
  ]);
  const writes: string[] = [];
  const storage: PackKeyValueStorage = {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => {
      writes.push(key);
      if (key === PACK_CORRUPT_BACKUP_KEY) await backupWrite.promise;
      stored.set(key, value);
    },
  };
  const persistence = createPackPersistence(storage);
  assert.equal((await persistence.hydrate()).status, "corrupt-data");
  const unregister = registerPackPersistenceForOwnerWipe(persistence);

  const recovery = persistence.recoverCorruptData();
  await Promise.resolve();
  const prepared = prepareMountedPackPersistenceForOwnerWipe();
  let preparationFinished = false;
  void prepared.then(() => {
    preparationFinished = true;
  });
  await Promise.resolve();
  assert.equal(
    preparationFinished,
    false,
    "the wipe must wait for recovery storage work",
  );

  backupWrite.resolve();
  assert.deepEqual(await recovery, { status: "read-failed" });
  await prepared;
  stored.clear();
  await Promise.resolve();

  assert.deepEqual(writes, [PACK_CORRUPT_BACKUP_KEY]);
  assert.equal(stored.size, 0);
  unregister();
});

test("storage warnings provide persistent owner-readable recovery copy", () => {
  assert.deepEqual(getPackStorageWarningPresentation("read-failed"), {
    title: "Pack couldn't load safely",
    message: "Changes are paused so your saved Pack data isn't overwritten.",
    retryLabel: "Retry loading Pack",
  });
  assert.deepEqual(getPackStorageWarningPresentation("save-failed"), {
    title: "Pack changes aren't saved yet",
    message: "Keep the app open and retry before leaving Pack.",
    retryLabel: "Retry saving Pack",
  });
  assert.deepEqual(getPackStorageWarningPresentation("corrupt-data"), {
    title: "Pack data needs recovery",
    message:
      "Changes are paused because saved Pack data could not be read safely.",
    retryLabel: "Retry loading Pack",
    recoveryLabel: "Back up and reset Pack",
  });
});
