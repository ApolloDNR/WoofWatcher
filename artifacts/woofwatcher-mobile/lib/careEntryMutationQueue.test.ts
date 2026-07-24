import assert from "node:assert/strict";
import { setImmediate as delayOneTurn } from "node:timers/promises";
import { test } from "node:test";

import { createCareEntryMutationQueue } from "./careEntryMutationQueue.ts";
import {
  discardConflictedCareEntryMutations,
  mergeServerAndLocalEntries,
} from "./careSync.ts";

interface TestEntry {
  id: string;
  revision: number;
  note: string;
  mood?: string;
  type?: string;
  occurredAt?: string;
  syncStatus?: "local" | "pending" | "synced" | "failed" | "conflict";
  syncError?: string;
  details?: Record<string, unknown>;
}

interface TestToken {
  generation: number;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function entry(
  note: string,
  revision = 1,
  mood?: string,
  id = "entry-1",
): TestEntry {
  return { id, revision, note, ...(mood ? { mood } : {}) };
}

function createHarness() {
  let generation = 1;
  const mutations: Array<{
    key: string;
    serverId: string;
    optimistic: TestEntry;
    expectedRevision: number;
    token: TestToken;
  }> = [];
  const gates: Deferred<TestEntry>[] = [];
  const synced: Array<{
    key: string;
    serverId: string;
    optimistic: TestEntry;
    returned: TestEntry;
  }> = [];
  const failed: Array<{
    key: string;
    serverId: string;
    optimistic: TestEntry;
    expectedRevision: number;
    error: unknown;
  }> = [];
  const conflicted: Array<{
    key: string;
    serverId: string;
    optimistic: TestEntry;
    current: TestEntry | null;
    error: unknown;
  }> = [];

  const queue = createCareEntryMutationQueue<TestEntry, TestToken>({
    mutate(input) {
      mutations.push(input);
      const gate = deferred<TestEntry>();
      gates.push(gate);
      return gate.promise;
    },
    getRevision(value) {
      return value.revision;
    },
    isCurrent(token) {
      return token.generation === generation;
    },
    getConflictEntry(error) {
      if (
        !error ||
        typeof error !== "object" ||
        (error as { status?: unknown }).status !== 409
      ) {
        return null;
      }
      const current = (error as { data?: unknown }).data;
      return current && typeof current === "object"
        ? (current as TestEntry)
        : null;
    },
    onSynced(event) {
      synced.push(event);
    },
    onFailed(event) {
      failed.push(event);
    },
    onConflict(event) {
      conflicted.push(event);
    },
  });

  return {
    queue,
    mutations,
    gates,
    synced,
    failed,
    conflicted,
    token: (): TestToken => ({ generation }),
    bumpGeneration() {
      generation += 1;
    },
  };
}

test("serializes same-entry edits and commits only the newest optimistic snapshot", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("Note A"),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("Note B", 1, "happy"),
    token,
  });

  assert.equal(
    harness.mutations.length,
    1,
    "request 2 must not start while request 1 is unresolved",
  );
  assert.equal(harness.mutations[0]?.expectedRevision, 1);

  harness.gates[0]?.resolve(entry("Note A", 2));
  await delayOneTurn();

  assert.equal(harness.synced.length, 0, "the stale first row must not commit");
  assert.equal(harness.mutations.length, 2);
  assert.equal(harness.mutations[1]?.expectedRevision, 2);
  assert.equal(harness.mutations[1]?.optimistic.note, "Note B");
  assert.equal(harness.mutations[1]?.optimistic.mood, "happy");

  harness.gates[1]?.resolve(entry("Note B", 3, "happy"));
  await delayOneTurn();

  assert.equal(harness.synced.length, 1);
  assert.equal(harness.synced[0]?.optimistic.note, "Note B");
  assert.equal(harness.synced[0]?.optimistic.mood, "happy");
  assert.equal(harness.synced[0]?.returned.revision, 3);
  assert.equal(harness.failed.length, 0);
  assert.equal(harness.conflicted.length, 0);
});

test("coalesces three later edits into one follow-up transport request", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  for (const optimistic of [
    entry("B"),
    entry("C", 1, "calm"),
    entry("D", 1, "happy"),
  ]) {
    harness.queue.enqueue({
      key: "entry-1",
      serverId: "entry-1",
      optimistic,
      token,
    });
  }

  assert.equal(harness.mutations.length, 1);
  harness.gates[0]?.resolve(entry("A", 2));
  await delayOneTurn();

  assert.equal(harness.mutations.length, 2);
  assert.equal(harness.mutations[1]?.optimistic.note, "D");
  assert.equal(harness.mutations[1]?.optimistic.mood, "happy");
  assert.equal(harness.mutations[1]?.expectedRevision, 2);

  harness.gates[1]?.resolve(entry("D", 3, "happy"));
  await delayOneTurn();
  assert.equal(harness.synced.length, 1);
});

test("refresh fencing retains a queued follow-up until classification finishes", async () => {
  const harness = createHarness();
  const token = harness.token();
  const first = {
    ...entry("A", 1),
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    syncStatus: "pending" as const,
  };
  const latest = {
    ...first,
    note: "B",
  };

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: first,
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: latest,
    token,
  });

  const pauseToken = harness.queue.pause();
  const quiescence = harness.queue.waitForInFlight(pauseToken);
  harness.gates[0]?.resolve({
    ...first,
    revision: 2,
    syncStatus: "synced",
  });
  await quiescence;
  assert.equal(
    harness.mutations.length,
    1,
    "the refresh fence must retain B until classification",
  );

  const merged = mergeServerAndLocalEntries(
    [latest],
    [
      {
        ...first,
        revision: 2,
        syncStatus: "synced" as const,
      },
    ],
    { hasQueuedMutation: harness.queue.hasQueuedMutation },
  );
  assert.equal(merged[0]?.syncStatus, "pending");
  harness.queue.resume(pauseToken);

  assert.equal(merged[0]?.note, "B");
  assert.equal(harness.mutations.length, 2);
  assert.equal(harness.mutations[1]?.optimistic.note, "B");
  assert.equal(harness.mutations[1]?.expectedRevision, 2);
});

test("refresh failure resumes a fenced queue and drains the retained follow-up", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("B"),
    token,
  });

  const pauseToken = harness.queue.pause();
  const quiescence = harness.queue.waitForInFlight(pauseToken);
  harness.gates[0]?.resolve(entry("A", 2));
  await quiescence;
  assert.equal(harness.mutations.length, 1);

  harness.queue.resume(pauseToken);
  assert.equal(harness.mutations.length, 2);
  assert.equal(harness.mutations[1]?.optimistic.note, "B");
  assert.equal(harness.mutations[1]?.expectedRevision, 2);
});

test("refresh quiescence observes terminal failure before accepting a list snapshot", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("B"),
    token,
  });

  const pauseToken = harness.queue.pause();
  const quiescence = harness.queue.waitForInFlight(pauseToken);
  harness.gates[0]?.reject(new Error("offline"));
  await quiescence;

  assert.equal(harness.failed.length, 1);
  assert.equal(harness.failed[0]?.optimistic.note, "B");
  assert.equal(harness.queue.hasQueuedMutation("entry-1"), false);
  harness.queue.resume(pauseToken);
  assert.equal(harness.mutations.length, 1);
});

test("refresh quiescence times out instead of waiting forever for a hung PATCH", async () => {
  const harness = createHarness();
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("Hung"),
    token: harness.token(),
  });

  const pauseToken = harness.queue.pause();
  const result = await harness.queue.waitForInFlight(
    pauseToken,
    5,
  );
  assert.equal(result, "timeout");
  assert.equal(harness.mutations.length, 1);
  harness.queue.resume(pauseToken);
});

test("quiescence lets a delayed success settle before a newer list revision wins", async () => {
  const harness = createHarness();
  const token = harness.token();
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("Delayed B"),
    token,
  });

  const pauseToken = harness.queue.pause();
  const quiescence = harness.queue.waitForInFlight(
    pauseToken,
    100,
  );
  harness.gates[0]?.resolve(entry("Delayed B", 2));
  assert.equal(await quiescence, "quiescent");
  assert.equal(harness.synced[0]?.returned.revision, 2);

  const merged = mergeServerAndLocalEntries(
    [
      {
        ...harness.synced[0]!.returned,
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        syncStatus: "synced" as const,
      },
    ],
    [
      {
        ...entry("Household revision three", 3),
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        syncStatus: "synced" as const,
      },
    ],
  );
  assert.equal(merged[0]?.revision, 3);
  assert.equal(merged[0]?.note, "Household revision three");
  harness.queue.resume(pauseToken);
});

test("refresh discards every row that genuinely merged as a conflict", () => {
  const discarded: string[] = [];
  const merged = mergeServerAndLocalEntries(
    [
      {
        ...entry("Local failed edit", 1),
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        syncStatus: "failed" as const,
      },
    ],
    [
      {
        ...entry("New household edit", 2),
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged[0]?.syncStatus, "conflict");
  discardConflictedCareEntryMutations(merged, (key) => {
    discarded.push(key);
  });
  assert.deepEqual(discarded, ["entry-1"]);
});

test("a queue clear resolves quiescence and makes a late pause release inert", async () => {
  const harness = createHarness();
  harness.queue.enqueue({
    key: "old-entry",
    serverId: "old-entry",
    optimistic: entry("Old generation", 1, undefined, "old-entry"),
    token: harness.token(),
  });
  const stalePauseToken = harness.queue.pause();
  const staleQuiescence =
    harness.queue.waitForInFlight(stalePauseToken, 100);
  harness.queue.clear();
  assert.equal(await staleQuiescence, "quiescent");

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("New generation"),
    token: harness.token(),
  });
  assert.equal(harness.mutations.length, 2);

  harness.queue.resume(stalePauseToken);
  assert.equal(harness.mutations.length, 2);
});

test("clear invalidates settling work, callbacks, and queued follow-up edits", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("B"),
    token,
  });
  harness.queue.clear();
  harness.gates[0]?.resolve(entry("A", 2));
  await delayOneTurn();

  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.synced.length, 0);
  assert.equal(harness.failed.length, 0);
  assert.equal(harness.conflicted.length, 0);
});

test("a stale lifecycle token cannot commit or drain after the request settles", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("B"),
    token,
  });
  harness.bumpGeneration();
  harness.gates[0]?.resolve(entry("A", 2));
  await delayOneTurn();

  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.synced.length, 0);
  assert.equal(harness.failed.length, 0);
  assert.equal(harness.conflicted.length, 0);
});

test("a current-generation edit replaces stale in-flight state for the same key", async () => {
  const harness = createHarness();
  const staleToken = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("old owner edit"),
    token: staleToken,
  });
  harness.bumpGeneration();
  const currentToken = harness.token();
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("current owner edit"),
    token: currentToken,
  });

  assert.equal(
    harness.mutations.length,
    2,
    "the current edit must not wait behind a stale-generation request",
  );
  harness.gates[0]?.resolve(entry("old owner edit", 2));
  await delayOneTurn();
  assert.equal(
    harness.synced.length,
    0,
    "the stale response must not commit or delete current queue state",
  );

  harness.gates[1]?.resolve(entry("current owner edit", 2));
  await delayOneTurn();
  assert.equal(harness.synced.length, 1);
  assert.equal(harness.synced[0]?.optimistic.note, "current owner edit");
});

test("binds a temporary create key and drains exactly one latest patch", async () => {
  const harness = createHarness();
  const token = harness.token();

  for (const optimistic of [
    entry("A", 1, undefined, "temp-1"),
    entry("B", 1, "calm", "temp-1"),
    entry("C", 1, "happy", "temp-1"),
  ]) {
    harness.queue.enqueue({
      key: "temp-1",
      optimistic,
      token,
    });
  }
  assert.equal(harness.mutations.length, 0);

  const latest = harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 1,
    token,
  });

  assert.equal(latest?.note, "C");
  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.mutations[0]?.serverId, "server-1");
  assert.equal(harness.mutations[0]?.expectedRevision, 1);
  assert.equal(harness.mutations[0]?.optimistic.note, "C");
  assert.equal(harness.mutations[0]?.optimistic.mood, "happy");

  harness.gates[0]?.resolve(entry("C", 2, "happy", "server-1"));
  await delayOneTurn();
  assert.equal(harness.synced.length, 1);
  assert.equal(harness.synced[0]?.serverId, "server-1");
});

test("an edit after temp binding stays behind the bound in-flight patch", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "temp-1",
    optimistic: entry("Queued before create", 1, undefined, "temp-1"),
    token,
  });
  harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 1,
    token,
  });
  harness.queue.enqueue({
    key: "server-1",
    serverId: "server-1",
    optimistic: entry("Newest edit", 1, "happy", "server-1"),
    token,
  });

  assert.equal(
    harness.mutations.length,
    1,
    "temp and server ids must share one in-flight mutation state",
  );

  harness.gates[0]?.resolve(
    entry("Queued before create", 2, undefined, "server-1"),
  );
  await delayOneTurn();

  assert.equal(harness.synced.length, 0);
  assert.equal(harness.mutations.length, 2);
  assert.equal(harness.mutations[1]?.expectedRevision, 2);
  assert.equal(harness.mutations[1]?.optimistic.note, "Newest edit");

  harness.gates[1]?.resolve(entry("Newest edit", 3, "happy", "server-1"));
  await delayOneTurn();

  assert.equal(harness.synced.length, 1);
  assert.equal(harness.synced[0]?.optimistic.note, "Newest edit");
  assert.equal(harness.conflicted.length, 0);
});

test("binding into an active server key preserves one transport and coalesces the newest desired edit", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "server-1",
    serverId: "server-1",
    optimistic: entry("Server request", 1, undefined, "server-1"),
    token,
  });
  harness.queue.enqueue({
    key: "temp-1",
    optimistic: entry("Temp desired", 1, "calm", "temp-1"),
    token,
  });
  harness.queue.enqueue({
    key: "server-1",
    serverId: "server-1",
    optimistic: entry("Newest desired", 1, "happy", "server-1"),
    token,
  });
  const latest = harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 1,
    token,
  });

  assert.equal(latest?.note, "Newest desired");
  assert.equal(
    harness.mutations.length,
    1,
    "binding must not overwrite the active canonical transport",
  );

  harness.gates[0]?.resolve(
    entry("Server request", 2, undefined, "server-1"),
  );
  await delayOneTurn();

  assert.equal(harness.synced.length, 0);
  assert.equal(harness.mutations.length, 2);
  assert.equal(harness.mutations[1]?.expectedRevision, 2);
  assert.equal(harness.mutations[1]?.optimistic.note, "Newest desired");
  assert.equal(harness.mutations[1]?.optimistic.mood, "happy");

  harness.gates[1]?.resolve(
    entry("Newest desired", 3, "happy", "server-1"),
  );
  await delayOneTurn();
  assert.equal(harness.synced.length, 1);
  assert.equal(harness.failed.length, 0);
});

test("binding drops a temp desire older than the surviving canonical request", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "temp-1",
    optimistic: entry("Older temp edit", 1, "calm", "temp-1"),
    token,
  });
  harness.queue.enqueue({
    key: "server-1",
    serverId: "server-1",
    optimistic: entry("Newer server edit", 1, "happy", "server-1"),
    token,
  });
  harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 1,
    token,
  });

  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.mutations[0]?.optimistic.note, "Newer server edit");

  harness.gates[0]?.resolve(
    entry("Newer server edit", 2, "happy", "server-1"),
  );
  await delayOneTurn();

  assert.equal(
    harness.mutations.length,
    1,
    "an older temp snapshot must not follow a newer committed request",
  );
  assert.equal(harness.synced.length, 1);
  assert.equal(harness.synced[0]?.optimistic.note, "Newer server edit");
});

test("discarding a colliding temp alias suppresses the preserved canonical callback", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "server-1",
    serverId: "server-1",
    optimistic: entry("Server request", 1, undefined, "server-1"),
    token,
  });
  harness.queue.enqueue({
    key: "temp-1",
    optimistic: entry("Temp desired", 1, undefined, "temp-1"),
    token,
  });
  harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 1,
    token,
  });
  harness.queue.discard("temp-1");
  harness.gates[0]?.resolve(
    entry("Server request", 2, undefined, "server-1"),
  );
  await delayOneTurn();

  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.synced.length, 0);
  assert.equal(harness.failed.length, 0);
  assert.equal(harness.conflicted.length, 0);
});

test("clear invalidates a preserved canonical request after alias collision", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "server-1",
    serverId: "server-1",
    optimistic: entry("Server request", 1, undefined, "server-1"),
    token,
  });
  harness.queue.enqueue({
    key: "temp-1",
    optimistic: entry("Temp desired", 1, undefined, "temp-1"),
    token,
  });
  harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 1,
    token,
  });
  harness.queue.clear();
  harness.gates[0]?.resolve(
    entry("Server request", 2, undefined, "server-1"),
  );
  await delayOneTurn();

  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.synced.length, 0);
  assert.equal(harness.failed.length, 0);
  assert.equal(harness.conflicted.length, 0);
});

test("discarding a bound temp alias suppresses its in-flight callback", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "temp-1",
    optimistic: entry("Bound edit", 1, undefined, "temp-1"),
    token,
  });
  harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 1,
    token,
  });
  harness.queue.discard("temp-1");
  harness.gates[0]?.resolve(entry("Bound edit", 2, undefined, "server-1"));
  await delayOneTurn();

  assert.equal(harness.synced.length, 0);
  assert.equal(harness.failed.length, 0);
  assert.equal(harness.conflicted.length, 0);
});

test("discarded temporary work cannot drain on this or a later refresh", () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "temp-1",
    optimistic: entry("Stale temp edit", 1, undefined, "temp-1"),
    token,
  });
  harness.queue.discard("temp-1");

  const first = harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 2,
    token,
  });
  const later = harness.queue.bindServerIdentity({
    key: "temp-1",
    serverId: "server-1",
    revision: 3,
    token,
  });

  assert.equal(first, undefined);
  assert.equal(later, undefined);
  assert.equal(harness.mutations.length, 0);
});

test("a 409 preserves the newest optimistic fields, surfaces conflict, and never auto-retries", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("B", 1, "happy"),
    token,
  });
  const current = entry("Household edit", 2, "calm");
  harness.gates[0]?.reject({ status: 409, data: current });
  await delayOneTurn();

  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.conflicted.length, 1);
  assert.equal(harness.conflicted[0]?.optimistic.note, "B");
  assert.equal(harness.conflicted[0]?.optimistic.mood, "happy");
  assert.deepEqual(harness.conflicted[0]?.current, current);
  assert.equal(harness.synced.length, 0);
  assert.equal(harness.failed.length, 0);
});

test("a transport failure reports the newest optimistic snapshot without draining it", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("B", 1, "happy"),
    token,
  });
  const error = new Error("offline");
  harness.gates[0]?.reject(error);
  await delayOneTurn();

  assert.equal(harness.mutations.length, 1);
  assert.equal(harness.failed.length, 1);
  assert.equal(harness.failed[0]?.optimistic.note, "B");
  assert.equal(harness.failed[0]?.optimistic.mood, "happy");
  assert.equal(harness.failed[0]?.error, error);
  assert.equal(harness.synced.length, 0);
  assert.equal(harness.conflicted.length, 0);
});

test("a queued failure reports the advanced base revision for safe refresh and retry", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A", 1),
    token,
  });
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("B", 1, "happy"),
    token,
  });

  harness.gates[0]?.resolve(entry("A", 2));
  await delayOneTurn();
  assert.equal(harness.mutations[1]?.expectedRevision, 2);

  harness.gates[1]?.reject(new Error("offline"));
  await delayOneTurn();

  assert.equal(harness.failed.length, 1);
  assert.equal(harness.failed[0]?.optimistic.note, "B");
  assert.equal(
    harness.failed[0]?.expectedRevision,
    2,
    "the failed optimistic row must retain the queue's latest server base",
  );

  const retryable = {
    ...harness.failed[0]!.optimistic,
    revision: harness.failed[0]!.expectedRevision,
  };
  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: retryable,
    token,
  });
  assert.equal(harness.mutations[2]?.expectedRevision, 2);
});

test("an out-of-range server revision fails closed before poisoning the next PATCH", async () => {
  const harness = createHarness();
  const token = harness.token();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("A"),
    token,
  });
  harness.gates[0]?.resolve(entry("Malformed server row", 2_147_483_648));
  await delayOneTurn();

  assert.equal(harness.synced.length, 0);
  assert.equal(harness.failed.length, 1);
  assert.match(String(harness.failed[0]?.error), /revision/i);
});

test("unchanged, backward, or jumping success revisions fail closed without draining", async () => {
  for (const returnedRevision of [3, 2, 5]) {
    const harness = createHarness();
    const token = harness.token();

    harness.queue.enqueue({
      key: "entry-1",
      serverId: "entry-1",
      optimistic: entry("A", 3),
      token,
    });
    harness.queue.enqueue({
      key: "entry-1",
      serverId: "entry-1",
      optimistic: entry("B", 3),
      token,
    });
    harness.gates[0]?.resolve(entry("Malformed success", returnedRevision));
    await delayOneTurn();

    assert.equal(
      harness.mutations.length,
      1,
      `returned revision ${returnedRevision}`,
    );
    assert.equal(
      harness.failed.length,
      1,
      `returned revision ${returnedRevision}`,
    );
    assert.equal(harness.failed[0]?.optimistic.note, "B");
    assert.equal(harness.synced.length, 0);
  }
});

test("a stored maximum revision cannot start an overflowing PATCH", () => {
  const harness = createHarness();

  harness.queue.enqueue({
    key: "entry-1",
    serverId: "entry-1",
    optimistic: entry("No overflow", 2_147_483_647),
    token: harness.token(),
  });

  assert.equal(harness.mutations.length, 0);
  assert.equal(harness.failed.length, 1);
  assert.match(String(harness.failed[0]?.error), /revision/i);
});
