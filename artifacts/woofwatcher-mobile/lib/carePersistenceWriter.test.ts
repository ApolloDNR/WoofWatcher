import assert from "node:assert/strict";
import { test } from "node:test";

import { createCarePersistenceWriter } from "./carePersistenceWriter.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("serializes snapshots so an older slow write cannot overtake the latest state", async () => {
  const first = deferred<void>();
  const writes: string[] = [];
  const writer = createCarePersistenceWriter<string>(async (value) => {
    if (value === "old") await first.promise;
    writes.push(value);
  });

  const oldWrite = writer.enqueue("old");
  const newWrite = writer.enqueue("new");
  first.resolve();
  await Promise.all([oldWrite, newWrite]);

  assert.deepEqual(writes, ["old", "new"]);
});

test("invalidation lets the active write settle but prevents a queued stale write", async () => {
  const first = deferred<void>();
  const writes: string[] = [];
  const writer = createCarePersistenceWriter<string>(async (value) => {
    if (value === "active") await first.promise;
    writes.push(value);
  });

  const active = writer.enqueue("active");
  const stale = writer.enqueue("stale");
  let invalidationSettled = false;
  const invalidation = writer.invalidateAndDrain().then(() => {
    invalidationSettled = true;
  });
  await Promise.resolve();
  assert.equal(invalidationSettled, false);

  first.resolve();
  await Promise.allSettled([active, stale, invalidation]);

  assert.equal(invalidationSettled, true);
  assert.deepEqual(writes, ["active"]);
});

test("a rejected active write does not stall the next valid write", async () => {
  const failure = new Error("storage unavailable");
  const attempts: string[] = [];
  const writer = createCarePersistenceWriter<string>(async (value) => {
    attempts.push(value);
    if (value === "rejected") throw failure;
  });

  const rejected = writer.enqueue("rejected");
  const valid = writer.enqueue("valid");
  const [rejectedResult, validResult] = await Promise.allSettled([
    rejected,
    valid,
  ]);

  assert.deepEqual(attempts, ["rejected", "valid"]);
  assert.deepEqual(rejectedResult, { status: "rejected", reason: failure });
  assert.deepEqual(validResult, { status: "fulfilled", value: undefined });
});

test("drain waits for all work accepted before the drain call", async () => {
  const gate = deferred<void>();
  const writer = createCarePersistenceWriter<string>(async () => {
    await gate.promise;
  });

  const accepted = writer.enqueue("snapshot");
  let drainSettled = false;
  const drain = writer.drain().then(() => {
    drainSettled = true;
  });
  await Promise.resolve();
  assert.equal(drainSettled, false);

  gate.resolve();
  await Promise.all([accepted, drain]);

  assert.equal(drainSettled, true);
});

test("the writer accepts a fresh generation after invalidation", async () => {
  const first = deferred<void>();
  const writes: string[] = [];
  const writer = createCarePersistenceWriter<string>(async (value) => {
    if (value === "active") await first.promise;
    writes.push(value);
  });

  const active = writer.enqueue("active");
  const stale = writer.enqueue("stale");
  const invalidation = writer.invalidateAndDrain();
  const fresh = writer.enqueue("fresh");
  first.resolve();
  await Promise.allSettled([active, stale, invalidation, fresh]);

  assert.deepEqual(writes, ["active", "fresh"]);
});
