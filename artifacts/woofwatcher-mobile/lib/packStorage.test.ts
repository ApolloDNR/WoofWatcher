import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SUPPLIES } from "./packSupplies.ts";
import {
  createPackWriteCoordinator,
  getPackStorageKey,
  inspectPackStateStorage,
  serializePackState,
} from "./packStorage.ts";
import { defaultTravelBag, renameTravelBag } from "./travelBag.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("pack state round-trips supplies and travel session in one envelope", () => {
  const state = {
    supplies: DEFAULT_SUPPLIES.map((item) => ({ ...item })),
    travelBag: renameTravelBag(defaultTravelBag(), "Vet visit"),
  };

  const inspected = inspectPackStateStorage(serializePackState(state));
  assert.equal(inspected.status, "valid");
  assert.deepEqual(inspected.state, state);
});

test("pack state rejects a partially corrupt envelope instead of defaulting one half", () => {
  const corrupt = JSON.stringify({
    version: 1,
    suppliesPayload: JSON.stringify({ version: 2, items: [] }),
    travelBagPayload: "{broken",
  });

  const inspected = inspectPackStateStorage(corrupt);
  assert.equal(inspected.status, "invalid");
  assert.equal(inspected.state, null);
});

test("a missing atomic envelope remains distinguishable for legacy migration", () => {
  const inspected = inspectPackStateStorage(null);
  assert.equal(inspected.status, "missing");
  assert.equal(inspected.state, null);
});

test("pack storage keys are isolated by account and household", () => {
  const a1 = getPackStorageKey({
    kind: "account",
    userId: "user-a",
    householdId: "house-1",
  });
  const b1 = getPackStorageKey({
    kind: "account",
    userId: "user-b",
    householdId: "house-1",
  });
  const a2 = getPackStorageKey({
    kind: "account",
    userId: "user-a",
    householdId: "house-2",
  });

  assert.notEqual(a1, b1);
  assert.notEqual(a1, a2);
  assert.match(a1, /account\.user-a\.house-1\.pack\.v1$/);
  assert.equal(getPackStorageKey({ kind: "local" }), "woofwatcher.v3.local.pack.v1");
});

test("serialized writes preserve a supplies change followed by a travel-bag change", async () => {
  const firstWrite = deferred<void>();
  const persisted: ReturnType<typeof inspectPackStateStorage>[] = [];
  const coordinator = createPackWriteCoordinator({
    supplies: DEFAULT_SUPPLIES.map((item) => ({ ...item })),
    travelBag: defaultTravelBag(),
  });

  const suppliesWrite = coordinator.enqueue(
    (current) => ({
      ...current,
      supplies: current.supplies.map((item, index) =>
        index === 0 ? { ...item, status: "plenty" } : item,
      ),
    }),
    async (next) => {
      persisted.push(inspectPackStateStorage(serializePackState(next)));
      await firstWrite.promise;
    },
  );
  const bagWrite = coordinator.enqueue(
    (current) => ({
      ...current,
      travelBag: renameTravelBag(current.travelBag, "Beach weekend"),
    }),
    async (next) => {
      persisted.push(inspectPackStateStorage(serializePackState(next)));
    },
  );

  await Promise.resolve();
  assert.equal(persisted.length, 1, "the second write must wait for the first");
  firstWrite.resolve();
  await Promise.all([suppliesWrite, bagWrite]);

  assert.equal(persisted.length, 2);
  assert.equal(persisted[1]?.status, "valid");
  assert.equal(persisted[1]?.state?.supplies[0]?.status, "plenty");
  assert.equal(persisted[1]?.state?.travelBag.label, "Beach weekend");
});

test("serialized writes preserve a travel-bag change followed by a supplies change", async () => {
  const firstWrite = deferred<void>();
  const persisted: ReturnType<typeof inspectPackStateStorage>[] = [];
  const coordinator = createPackWriteCoordinator({
    supplies: DEFAULT_SUPPLIES.map((item) => ({ ...item })),
    travelBag: defaultTravelBag(),
  });

  const bagWrite = coordinator.enqueue(
    (current) => ({
      ...current,
      travelBag: renameTravelBag(current.travelBag, "Vet visit"),
    }),
    async (next) => {
      persisted.push(inspectPackStateStorage(serializePackState(next)));
      await firstWrite.promise;
    },
  );
  const suppliesWrite = coordinator.enqueue(
    (current) => ({
      ...current,
      supplies: current.supplies.map((item, index) =>
        index === 1 ? { ...item, status: "low" } : item,
      ),
    }),
    async (next) => {
      persisted.push(inspectPackStateStorage(serializePackState(next)));
    },
  );

  await Promise.resolve();
  assert.equal(persisted.length, 1, "the second write must wait for the first");
  firstWrite.resolve();
  await Promise.all([bagWrite, suppliesWrite]);

  assert.equal(persisted.length, 2);
  assert.equal(persisted[1]?.status, "valid");
  assert.equal(persisted[1]?.state?.travelBag.label, "Vet visit");
  assert.equal(persisted[1]?.state?.supplies[1]?.status, "low");
});
