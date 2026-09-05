import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function loadCoordinator() {
  const module = await import("./careDocDurability.ts").catch(() => null);
  assert.ok(module, "the durable Care document coordinator must exist");
  return module.createCareDocDurabilityCoordinator;
}

async function loadAcceptedDocFence() {
  const module = await import("./careDocDurability.ts").catch(() => null);
  assert.ok(module, "the durable Care document coordinator must exist");
  return module.createAcceptedCareDocFence;
}

function createSnapshot() {
  return {
    storageKey: "woofwatcher.v2.state.account:user-apollo",
    ownerUserId: "user-apollo",
    householdId: "house-phoenix",
    doc: {
      updatedAt: "2026-09-04T18:00:00.000Z",
      profile: { name: "Luna" },
    },
    entries: [
      {
        id: "meal-1",
        title: "Breakfast",
        occurredAt: "2026-09-04T15:00:00.000Z",
      },
    ],
    serverVersion: 12,
    lastServerCareState: {
      version: 11,
      doc: { profile: { name: "Luna" } },
    },
  };
}

test("writes the exact accepted Care snapshot to its captured principal and household boundary", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  const writes: Array<{
    mutation: { kind: string; key: string; value: string };
    epoch: number;
  }> = [];
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 7,
    enqueue: async (
      mutation: { kind: string; key: string; value: string },
      epoch: number,
    ) => {
      writes.push({ mutation, epoch });
      return "applied" as const;
    },
  });
  const snapshot = createSnapshot();

  assert.deepEqual(await coordinator.persist(snapshot, () => true), {
    status: "applied",
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.epoch, 7);
  assert.equal(writes[0]?.mutation.kind, "set");
  assert.equal(writes[0]?.mutation.key, snapshot.storageKey);
  assert.deepEqual(JSON.parse(writes[0]!.mutation.value), {
    ownerUserId: "user-apollo",
    householdId: "house-phoenix",
    doc: snapshot.doc,
    entries: snapshot.entries,
    serverVersion: 12,
    lastServerCareState: snapshot.lastServerCareState,
  });
});

test("does not enqueue a Care snapshot after its principal or household fence is already stale", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  let writes = 0;
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 0,
    enqueue: async () => {
      writes += 1;
      return "applied" as const;
    },
  });

  assert.deepEqual(await coordinator.persist(createSnapshot(), () => false), {
    status: "stale",
  });
  assert.equal(writes, 0);
});

test("a Care write that becomes stale while storage is pending cannot publish durable success", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  const writeGate = deferred<"applied">();
  let current = true;
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 4,
    enqueue: () => writeGate.promise,
  });

  const write = coordinator.persist(createSnapshot(), () => current);
  await Promise.resolve();
  current = false;
  writeGate.resolve("applied");

  assert.deepEqual(await write, { status: "stale" });
});

test("accepted Care snapshot fence allows an exact provider echo but rejects a same-scope replacement", async () => {
  const createAcceptedCareDocFence = await loadAcceptedDocFence();
  const acceptedDoc = createSnapshot().doc;
  const acceptedDocIsCurrent = createAcceptedCareDocFence(acceptedDoc);

  assert.equal(
    acceptedDocIsCurrent(structuredClone(acceptedDoc)),
    true,
    "an exact provider acknowledgement must not falsely stale the local save",
  );
  assert.equal(
    acceptedDocIsCurrent({
      profile: { name: "Luna" },
      updatedAt: "2026-09-04T18:00:00.000Z",
    }),
    true,
    "a JSONB/provider echo with reordered object keys is still the same accepted document",
  );
  const nestedOrderFence = createAcceptedCareDocFence({
    profile: { name: "Luna", breed: "Shepherd" },
  });
  assert.equal(
    nestedOrderFence({ profile: { breed: "Shepherd", name: "Luna" } }),
    true,
    "nested provider objects are compared by JSON value rather than key order",
  );
  assert.equal(
    acceptedDocIsCurrent({
      ...acceptedDoc,
      profile: { name: "Server winner" },
    }),
    false,
    "a 403/conflict replacement in the same household must fence durable success",
  );
});

test("a delayed durable write is stale after the current Care document is replaced", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  const createAcceptedCareDocFence = await loadAcceptedDocFence();
  const writeGate = deferred<"applied">();
  const snapshot = createSnapshot();
  let currentDoc = snapshot.doc;
  const acceptedDocIsCurrent = createAcceptedCareDocFence(snapshot.doc);
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 4,
    enqueue: () => writeGate.promise,
  });

  const write = coordinator.persist(snapshot, () =>
    acceptedDocIsCurrent(currentDoc),
  );
  await Promise.resolve();
  currentDoc = {
    ...snapshot.doc,
    profile: { name: "Authoritative server dog" },
  };
  writeGate.resolve("applied");

  assert.deepEqual(await write, { status: "stale" });
});

test("CareContext applies the exact accepted-document fence to durable save success", () => {
  const source = readFileSync(
    new URL("../context/CareContext.tsx", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("const updateCareDocDurably = useCallback");
  const end = source.indexOf("const state = useMemo<CareState>", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const durableUpdate = source.slice(start, end);

  assert.match(
    durableUpdate,
    /const acceptedDocIsCurrent = createAcceptedCareDocFence\(snapshot\.doc\)/,
  );
  assert.match(
    durableUpdate,
    /const saveIsCurrent = \(\) =>[\s\S]*acceptedDocIsCurrent\(docRef\.current\)/,
  );
});

test("reports a rejected Care storage write without converting it to success", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  const storageError = new Error("device storage unavailable");
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 2,
    enqueue: async () => {
      throw storageError;
    },
  });

  const outcome = await coordinator.persist(createSnapshot(), () => true);
  assert.equal(outcome.status, "storage-failed");
  if (outcome.status === "storage-failed") {
    assert.equal(outcome.error, storageError);
  }
});

test("treats an owner-erase supersession as stale rather than durable success", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 8,
    enqueue: async () => "superseded" as const,
  });

  assert.deepEqual(await coordinator.persist(createSnapshot(), () => true), {
    status: "stale",
  });
});

test("consumes exactly one automatic write of the same directly persisted snapshot", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  const writeGate = deferred<"applied">();
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 3,
    enqueue: () => writeGate.promise,
  });
  const snapshot = createSnapshot();

  const directWrite = coordinator.persist(snapshot, () => true);
  assert.equal(coordinator.consumeAutomaticPersistence(snapshot), true);
  assert.equal(
    coordinator.consumeAutomaticPersistence(snapshot),
    false,
    "only the duplicate effect write is suppressed",
  );
  writeGate.resolve("applied");
  assert.deepEqual(await directWrite, { status: "applied" });
});

test("never suppresses an automatic snapshot containing newer entry state", async () => {
  const createCareDocDurabilityCoordinator = await loadCoordinator();
  const writeGate = deferred<"applied">();
  const coordinator = createCareDocDurabilityCoordinator({
    currentEpoch: () => 5,
    enqueue: () => writeGate.promise,
  });
  const snapshot = createSnapshot();
  const directWrite = coordinator.persist(snapshot, () => true);
  const newerSnapshot = {
    ...snapshot,
    entries: [
      ...snapshot.entries,
      {
        id: "walk-2",
        title: "Evening walk",
        occurredAt: "2026-09-04T23:00:00.000Z",
      },
    ],
  };

  assert.equal(coordinator.consumeAutomaticPersistence(newerSnapshot), false);
  assert.equal(
    coordinator.consumeAutomaticPersistence(snapshot),
    false,
    "a mismatched newer render invalidates the old duplicate marker",
  );
  writeGate.resolve("applied");
  assert.deepEqual(await directWrite, { status: "applied" });
});
