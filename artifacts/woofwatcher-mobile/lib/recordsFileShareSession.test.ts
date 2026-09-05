import assert from "node:assert/strict";
import test from "node:test";

import { createRecordsFileShareSession } from "./recordsFileShareSession.ts";

test("admits only one Records file share until the active native request settles", async () => {
  const session = createRecordsFileShareSession();
  const pending: boolean[] = [];
  let releaseFirst!: () => void;
  const firstTask = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let secondCalls = 0;

  const first = session.run(() => firstTask, (value) => pending.push(value));
  const second = await session.run(async () => {
    secondCalls += 1;
  });

  assert.equal(second, false);
  assert.equal(secondCalls, 0);
  assert.equal(session.isPending(), true);

  releaseFirst();
  assert.equal(await first, true);
  assert.equal(session.isPending(), false);
  assert.deepEqual(pending, [true, false]);
});

test("releases the Records file share lock after a failed request", async () => {
  const session = createRecordsFileShareSession();

  await assert.rejects(session.run(async () => {
    throw new Error("share unavailable");
  }), /share unavailable/);

  assert.equal(session.isPending(), false);
  assert.equal(await session.run(async () => undefined), true);
});
