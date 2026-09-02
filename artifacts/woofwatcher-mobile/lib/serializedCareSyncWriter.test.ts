import test from "node:test";
import assert from "node:assert/strict";

import { createSerializedCareSyncWriter } from "./serializedCareSyncWriter.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

test("wipe barrier discards queued snapshots and waits for the active write", async () => {
  const firstWrite = deferred<void>();
  const writes: string[] = [];
  const writer = createSerializedCareSyncWriter<string>(async (value) => {
    writes.push(value);
    if (value === "old-active") await firstWrite.promise;
  });

  const active = writer.enqueue("old-active");
  const queued = writer.enqueue("old-queued");
  assert.equal(writer.discardPending(), 1);
  await queued;

  let drained = false;
  const barrier = writer.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  assert.equal(drained, false);

  firstWrite.resolve();
  await active;
  await barrier;
  await writer.enqueue("pristine");

  assert.deepEqual(writes, ["old-active", "pristine"]);
});

test("a rejected active write still releases drain waiters", async () => {
  const gate = deferred<void>();
  const writer = createSerializedCareSyncWriter<string>(async () => {
    await gate.promise;
    throw new Error("storage failed");
  });
  const failed = writer.enqueue("snapshot").catch(() => {});
  const drained = writer.drain();
  gate.resolve();
  await failed;
  await drained;
});

test("supersede fences delayed writes from the prior epoch", async () => {
  const firstWrite = deferred<void>();
  const writes: string[] = [];
  const writer = createSerializedCareSyncWriter<string>(async (value) => {
    writes.push(value);
    if (value === "old-active") await firstWrite.promise;
  });
  const oldEpoch = writer.currentEpoch();
  const active = writer.enqueue("old-active", oldEpoch);
  const queued = writer.enqueue("old-queued", oldEpoch);

  let wipeFinished = false;
  const wipe = writer.supersede("wipe").then(() => {
    wipeFinished = true;
  });
  await queued;
  await writer.enqueue("late-old", oldEpoch);
  await Promise.resolve();
  assert.equal(wipeFinished, false);

  firstWrite.resolve();
  await active;
  await wipe;
  assert.deepEqual(writes, ["old-active", "wipe"]);
});
