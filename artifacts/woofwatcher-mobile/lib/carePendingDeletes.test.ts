import assert from "node:assert/strict";
import { test } from "node:test";

import {
  commitCarePendingDeleteMutationIfCurrent,
  createCarePendingDeleteStore,
  parseCarePendingDeleteKeys,
} from "./carePendingDeletes.ts";

const scope = {
  kind: "account",
  userId: "user_a",
  householdId: "11111111-1111-4111-8111-111111111111",
} as const;

function inMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

test("pending-delete parsing rejects malformed and unbounded cache values", () => {
  assert.deepEqual(parseCarePendingDeleteKeys(null), []);
  assert.throws(() => parseCarePendingDeleteKeys(""), /invalid/i);
  assert.throws(
    () => parseCarePendingDeleteKeys('{"not":"an array"}'),
    /invalid/i,
  );
  assert.throws(
    () => parseCarePendingDeleteKeys(JSON.stringify(["temp_keep", "", 42])),
    /invalid/i,
  );
  assert.throws(
    () =>
      parseCarePendingDeleteKeys(
        JSON.stringify(Array.from({ length: 1_001 }, (_, i) => `temp_${i}`)),
      ),
    /capacity/i,
  );
});

test("a write-ahead temp tombstone survives a crash and suppresses its lost-response twin", async () => {
  const storage = inMemoryStorage();
  const beforeCrash = createCarePendingDeleteStore(storage);
  const tempId = "temp_1720000000000_abcde";

  await beforeCrash.add(scope, tempId);

  // A new store instance represents a process restart with no in-memory refs.
  const afterRestart = createCarePendingDeleteStore(storage);
  const restored = await afterRestart.read(scope);
  assert.deepEqual(restored, [tempId]);

  const returnedAfterLostResponse = {
    id: "22222222-2222-4222-8222-222222222222",
    details: { clientKey: tempId },
  };
  assert.equal(
    restored.includes(returnedAfterLostResponse.details.clientKey),
    true,
    "the complete-history merge can hide and clean up the resurrected server twin",
  );
});

test("a failed write-ahead tombstone never reports a durable delete", async () => {
  const storage = {
    async getItem() {
      return null;
    },
    async setItem() {
      throw new Error("device storage unavailable");
    },
  };
  const pendingDeletes = createCarePendingDeleteStore(storage);

  await assert.rejects(
    pendingDeletes.add(scope, "temp_not_durable"),
    /device storage unavailable/,
  );
  assert.deepEqual(await pendingDeletes.read(scope), []);
});

test("serialized add and remove operations cannot resurrect an older tombstone set", async () => {
  const storage = inMemoryStorage();
  const pendingDeletes = createCarePendingDeleteStore(storage);
  const first = pendingDeletes.add(scope, "temp_first");
  const second = pendingDeletes.add(scope, "temp_second");
  const removal = pendingDeletes.remove(scope, "temp_first");

  await Promise.all([first, second, removal]);
  assert.deepEqual(await pendingDeletes.read(scope), ["temp_second"]);
});

test("the 1,001st tombstone rejects instead of falsely reporting durability", async () => {
  const storage = inMemoryStorage();
  const initial = Array.from({ length: 1_000 }, (_, index) => `temp_${index}`);
  const pendingDeletes = createCarePendingDeleteStore(storage);
  await pendingDeletes.replace(scope, initial);

  await assert.rejects(
    pendingDeletes.add(scope, "temp_over_capacity"),
    /capacity/i,
  );
  assert.deepEqual(await pendingDeletes.read(scope), initial);
});

test("a hung H1 write cannot block an independent H2 tombstone queue", async () => {
  const h2 = {
    ...scope,
    householdId: "22222222-2222-4222-8222-222222222222",
  } as const;
  let releaseH1!: () => void;
  const h1Blocked = new Promise<void>((resolve) => {
    releaseH1 = resolve;
  });
  const values = new Map<string, string>();
  const storage = {
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      if (key.includes(scope.householdId)) await h1Blocked;
      values.set(key, value);
    },
  };
  const pendingDeletes = createCarePendingDeleteStore(storage);
  const h1Write = pendingDeletes.add(scope, "temp_h1");
  await new Promise<void>((resolve) => setImmediate(resolve));

  const h2Write = pendingDeletes.add(h2, "temp_h2");
  assert.deepEqual(await h2Write, ["temp_h2"]);

  releaseH1();
  assert.deepEqual(await h1Write, ["temp_h1"]);
});

test("forgetting in-memory tombstones observes a completed device wipe", async () => {
  const storage = inMemoryStorage();
  const pendingDeletes = createCarePendingDeleteStore(storage);
  await pendingDeletes.add(scope, "temp_before_wipe");
  storage.values.clear();

  pendingDeletes.forget(scope);

  assert.deepEqual(await pendingDeletes.read(scope), []);
});

test("a wipe can drain blocked writes before removal and clear the store cache", async () => {
  let releaseWrite!: () => void;
  const blocked = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const values = new Map<string, string>();
  const storage = {
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      await blocked;
      values.set(key, value);
    },
  };
  const pendingDeletes = createCarePendingDeleteStore(storage);
  const add = pendingDeletes.add(scope, "temp_before_wipe");
  let drained = false;
  const drain = pendingDeletes.waitForWrites().then(() => {
    drained = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(drained, false);

  releaseWrite();
  await Promise.all([add, drain]);
  values.clear();
  pendingDeletes.forget();

  assert.deepEqual(await pendingDeletes.read(scope), []);
});

for (const operation of ["add", "remove"] as const) {
  test(`a scope switch during a deferred ${operation} cannot commit stale tombstone state`, async () => {
    let current = true;
    let release!: () => void;
    const storageMutation = new Promise<void>((resolve) => {
      release = resolve;
    });
    let commits = 0;
    const pending = commitCarePendingDeleteMutationIfCurrent({
      mutate: () => storageMutation,
      isCurrent: () => current,
      commit: () => {
        commits += 1;
      },
    });
    current = false;
    release();

    assert.equal(await pending, false);
    assert.equal(commits, 0);
  });
}

test("same-scope continuation observes a tombstone transition only after its synchronous commit", async () => {
  let release!: () => void;
  const storageMutation = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entryId = "33333333-3333-4333-8333-333333333333";
  const removed = { id: entryId, title: "Local edit" };
  const pendingIds = new Set([entryId]);
  let entries = [{ id: entryId, title: "Queued history row" }];
  let mutationGeneration = 0;
  let continuationSnapshot:
    | {
        pending: boolean;
        titles: string[];
        mutationGeneration: number;
      }
    | undefined;

  const transition = commitCarePendingDeleteMutationIfCurrent({
    mutate: () => storageMutation,
    isCurrent: () => true,
    commit: () => {
      pendingIds.delete(entryId);
      entries = [removed, ...entries.filter((entry) => entry.id !== entryId)];
      mutationGeneration += 1;
    },
  }).then(() => {
    continuationSnapshot = {
      pending: pendingIds.has(entryId),
      titles: entries.map((entry) => entry.title),
      mutationGeneration,
    };
  });

  release();
  await transition;

  assert.deepEqual(continuationSnapshot, {
    pending: false,
    titles: ["Local edit"],
    mutationGeneration: 1,
  });
});
