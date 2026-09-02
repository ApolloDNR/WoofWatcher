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
  PACK_SUPPLIES_KEY,
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
});
