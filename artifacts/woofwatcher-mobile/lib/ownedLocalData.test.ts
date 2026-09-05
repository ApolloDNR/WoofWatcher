import assert from "node:assert/strict";
import test from "node:test";

import {
  WOOFWATCHER_OWNED_DOCUMENT_DIRECTORIES,
  wipeOwnedDocumentDirectoriesIfCurrent,
  wipeWoofWatcherOwnedDataIfCurrent,
  wipeWoofWatcherKeysIfCurrent,
} from "./ownedLocalData.ts";
import {
  createPackPersistence,
  PACK_LEGACY_LOCAL_CLAIM_KEY,
  PACK_OWNER_WIPE_TOMBSTONE,
  PACK_SUPPLIES_KEY,
} from "./packPersistence.ts";
import { DEFAULT_SUPPLIES, serializeSupplies } from "./packSupplies.ts";
import {
  createSerializedCareSyncWriter,
  getOrCreateSharedCareSyncWriter,
} from "./serializedCareSyncWriter.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

test("a queued account-A wipe becomes superseded before it can remove account-B keys", async () => {
  const activeWrite = deferred<void>();
  const stored = new Map<string, string>([
    ["woofwatcher.v2.state.account.account-a", "account A"],
  ]);
  const removed: string[][] = [];
  let activePrincipal = "account-a";
  let wipeOutcome: "erased" | "superseded" | null = null;

  type Mutation = { kind: "hold" } | { kind: "wipe"; isCurrent: () => boolean };
  const writer = createSerializedCareSyncWriter<Mutation>(async (mutation) => {
    if (mutation.kind === "hold") {
      await activeWrite.promise;
      return;
    }
    wipeOutcome = await wipeWoofWatcherKeysIfCurrent({
      storage: {
        getAllKeys: async () => [...stored.keys()],
        multiRemove: async (keys) => {
          removed.push([...keys]);
          for (const key of keys) stored.delete(key);
        },
      },
      deletionLedgerKeyPrefix: "woofwatcher.v2.discarded-server-entry-ids",
      preservedExactKeys: ["woofwatcher.avatar.legacy-local-claim.v1"],
      isCurrent: mutation.isCurrent,
    });
  });

  const active = writer.enqueue({ kind: "hold" });
  const wipe = writer.supersede({
    kind: "wipe",
    isCurrent: () => activePrincipal === "account-a",
  });

  activePrincipal = "account-b";
  stored.set("woofwatcher.v2.state.account.account-b", "account B");
  activeWrite.resolve();

  assert.equal(await active, "applied");
  assert.equal(await wipe, "applied");
  assert.equal(wipeOutcome, "superseded");
  assert.deepEqual(removed, []);
  assert.equal(
    stored.get("woofwatcher.v2.state.account.account-b"),
    "account B",
  );
});

test("native document wiping stops before another directory after its Care session is invalidated", async () => {
  const firstDelete = deferred<void>();
  const firstDeleteStarted = deferred<void>();
  const deleted: string[] = [];
  let activePrincipal = "account-a";

  const operation = wipeOwnedDocumentDirectoriesIfCurrent({
    documentDirectory: "file:///documents/",
    fileSystem: {
      deleteAsync: async (uri) => {
        deleted.push(uri);
        if (deleted.length === 1) {
          firstDeleteStarted.resolve();
          await firstDelete.promise;
        }
      },
    },
    isCurrent: () => activePrincipal === "account-a",
  });

  await firstDeleteStarted.promise;
  activePrincipal = "account-b";
  firstDelete.resolve();

  assert.equal(await operation, "superseded");
  assert.deepEqual(deleted, [
    `file:///documents/${WOOFWATCHER_OWNED_DOCUMENT_DIRECTORIES[0]}/`,
  ]);
});

test("a replacement session drains the shared writer through native deletion before it writes account-B data", async () => {
  const firstDelete = deferred<void>();
  const firstDeleteStarted = deferred<void>();
  const stored = new Map<string, string>([
    ["woofwatcher.v2.state.account.account-a", "account A"],
  ]);
  const deleted: string[] = [];
  let activePrincipal = "account-a";
  let wipeOutcome: "erased" | "superseded" | null = null;

  type Mutation =
    | { kind: "set"; key: string; value: string }
    | { kind: "wipe"; isCurrent: () => boolean };
  const storage = {
    getAllKeys: async () => [...stored.keys()],
    multiRemove: async (keys: readonly string[]) => {
      for (const key of keys) stored.delete(key);
    },
  };
  const writeMutation = async (mutation: Mutation) => {
    if (mutation.kind === "set") {
      stored.set(mutation.key, mutation.value);
      return;
    }
    wipeOutcome = await wipeWoofWatcherOwnedDataIfCurrent({
      storage,
      deletionLedgerKeyPrefix: "woofwatcher.v2.discarded-server-entry-ids",
      preservedExactKeys: ["woofwatcher.avatar.legacy-local-claim.v1"],
      documentDirectory: "file:///documents/",
      fileSystem: {
        deleteAsync: async (uri) => {
          deleted.push(uri);
          if (deleted.length === 1) {
            firstDeleteStarted.resolve();
            await firstDelete.promise;
          }
        },
      },
      isCurrent: mutation.isCurrent,
    });
  };
  const departingWriter = getOrCreateSharedCareSyncWriter<Mutation>(
    storage,
    writeMutation,
  );

  const wipe = departingWriter.supersede({
    kind: "wipe",
    isCurrent: () => activePrincipal === "account-a",
  });
  await firstDeleteStarted.promise;

  activePrincipal = "account-b";
  const replacementWriter = getOrCreateSharedCareSyncWriter<Mutation>(
    storage,
    writeMutation,
  );
  assert.equal(
    replacementWriter,
    departingWriter,
    "the writer barrier must survive a principal-scoped provider remount",
  );
  let replacementDrainFinished = false;
  const replacementSession = (async () => {
    await replacementWriter.drain();
    replacementDrainFinished = true;
    await replacementWriter.enqueue({
      kind: "set",
      key: "woofwatcher.v2.state.account.account-b",
      value: "account B",
    });
  })();
  await Promise.resolve();
  assert.equal(replacementDrainFinished, false);

  firstDelete.resolve();
  assert.equal(await wipe, "applied");
  await replacementSession;

  assert.equal(wipeOutcome, "superseded");
  assert.equal(replacementDrainFinished, true);
  assert.equal(
    stored.get("woofwatcher.v2.state.account.account-b"),
    "account B",
  );
  assert.deepEqual(deleted, [
    `file:///documents/${WOOFWATCHER_OWNED_DOCUMENT_DIRECTORIES[0]}/`,
  ]);
});

test("a partial Pack key wipe leaves a tombstone that prevents another local dog from claiming surviving legacy data", async () => {
  const privateSupplies = DEFAULT_SUPPLIES.map((item) =>
    item.id === "essentials-food"
      ? { ...item, status: "out" as const, updatedAt: "2026-09-04T12:00:00.000Z" }
      : { ...item },
  );
  const stored = new Map<string, string>([
    [PACK_LEGACY_LOCAL_CLAIM_KEY, "complete:local.pet.dog-a"],
    [PACK_SUPPLIES_KEY, serializeSupplies(privateSupplies)],
  ]);
  const storage = {
    getAllKeys: async () => [...stored.keys()],
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      stored.set(key, value);
    },
    removeItem: async (key: string) => {
      stored.delete(key);
    },
    multiRemove: async (keys: readonly string[]) => {
      for (const key of keys) {
        if (key === PACK_SUPPLIES_KEY) {
          throw new Error("legacy Pack key is locked");
        }
        stored.delete(key);
      }
    },
  };

  await assert.rejects(
    wipeWoofWatcherOwnedDataIfCurrent({
      storage,
      deletionLedgerKeyPrefix: "woofwatcher.v2.discarded-server-entry-ids",
      terminalTombstones: [
        {
          key: PACK_LEGACY_LOCAL_CLAIM_KEY,
          value: PACK_OWNER_WIPE_TOMBSTONE,
        },
      ],
      documentDirectory: null,
      fileSystem: { deleteAsync: async () => undefined },
      isCurrent: () => true,
    }),
    /legacy Pack key is locked/,
  );
  assert.equal(
    stored.get(PACK_LEGACY_LOCAL_CLAIM_KEY),
    "complete:owner-wipe",
    "the reservation must outlive a partial platform removal",
  );

  const dogB = await createPackPersistence(storage, {
    scope: {
      ownerUserId: null,
      householdId: null,
      activePetId: "dog-b",
    },
  }).hydrate();
  assert.equal(dogB.status, "ready");
  if (dogB.status !== "ready") return;
  assert.deepEqual(dogB.supplies, [...DEFAULT_SUPPLIES]);
});

test("a successful owner wipe releases its Pack tombstone only after key and document deletion", async () => {
  const scopedPackKey =
    "woofwatcher.packSupplies.v2.scope.local.pet.dog-a";
  const stored = new Map<string, string>([
    [PACK_LEGACY_LOCAL_CLAIM_KEY, "complete:local.pet.dog-a"],
    [PACK_SUPPLIES_KEY, "legacy Pack"],
    [scopedPackKey, "scoped Pack"],
  ]);
  const events: string[] = [];
  const result = await wipeWoofWatcherOwnedDataIfCurrent({
    storage: {
      getAllKeys: async () => [...stored.keys()],
      setItem: async (key, value) => {
        events.push("reserve");
        stored.set(key, value);
      },
      multiRemove: async (keys) => {
        events.push("remove-keys");
        assert.equal(stored.has(PACK_LEGACY_LOCAL_CLAIM_KEY), true);
        assert.equal(keys.includes(PACK_LEGACY_LOCAL_CLAIM_KEY), false);
        for (const key of keys) stored.delete(key);
      },
      removeItem: async (key) => {
        events.push("release");
        stored.delete(key);
      },
    },
    deletionLedgerKeyPrefix: "woofwatcher.v2.discarded-server-entry-ids",
    terminalTombstones: [
      {
        key: PACK_LEGACY_LOCAL_CLAIM_KEY,
        value: PACK_OWNER_WIPE_TOMBSTONE,
      },
    ],
    documentDirectory: "file:///documents/",
    fileSystem: {
      deleteAsync: async (_uri) => {
        events.push("remove-directory");
        assert.equal(
          stored.has(PACK_LEGACY_LOCAL_CLAIM_KEY),
          true,
          "the Pack reservation must remain through native owner-data deletion",
        );
      },
    },
    isCurrent: () => true,
  });

  assert.equal(result, "erased");
  assert.equal(stored.has(PACK_LEGACY_LOCAL_CLAIM_KEY), false);
  assert.equal(stored.has(PACK_SUPPLIES_KEY), false);
  assert.equal(stored.has(scopedPackKey), false);
  assert.deepEqual(events, [
    "reserve",
    "remove-keys",
    "remove-directory",
    "remove-directory",
    "remove-directory",
    "release",
  ]);
});

test("a failed Pack tombstone release stays fenced and completes on a later owner retry", async () => {
  const stored = new Map<string, string>([
    [PACK_SUPPLIES_KEY, "legacy Pack"],
  ]);
  let failRelease = true;
  const storage = {
    getAllKeys: async () => [...stored.keys()],
    setItem: async (key: string, value: string) => {
      stored.set(key, value);
    },
    multiRemove: async (keys: readonly string[]) => {
      for (const key of keys) stored.delete(key);
    },
    removeItem: async (key: string) => {
      if (failRelease) throw new Error("claim marker is locked");
      stored.delete(key);
    },
  };
  const wipe = () =>
    wipeWoofWatcherOwnedDataIfCurrent({
      storage,
      deletionLedgerKeyPrefix: "woofwatcher.v2.discarded-server-entry-ids",
      terminalTombstones: [
        {
          key: PACK_LEGACY_LOCAL_CLAIM_KEY,
          value: PACK_OWNER_WIPE_TOMBSTONE,
        },
      ],
      documentDirectory: null,
      fileSystem: { deleteAsync: async () => undefined },
      isCurrent: () => true,
    });

  await assert.rejects(wipe(), /claim marker is locked/);
  assert.equal(stored.has(PACK_SUPPLIES_KEY), false);
  assert.equal(
    stored.get(PACK_LEGACY_LOCAL_CLAIM_KEY),
    "complete:owner-wipe",
  );

  failRelease = false;
  assert.equal(await wipe(), "erased");
  assert.equal(stored.has(PACK_LEGACY_LOCAL_CLAIM_KEY), false);
});
