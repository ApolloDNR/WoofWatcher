import assert from "node:assert/strict";
import { test } from "node:test";

import { createExclusiveAsyncAction } from "./exclusiveAsyncAction.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("a second activation is rejected while the first native action is pending", async () => {
  const first = deferred<string>();
  const events: string[] = [];
  const gate = createExclusiveAsyncAction();

  const active = gate.run(async () => {
    events.push("first:start");
    const value = await first.promise;
    events.push("first:end");
    return value;
  });
  const duplicate = await gate.run(async () => {
    events.push("duplicate:started");
    return "duplicate";
  });

  assert.deepEqual(duplicate, { status: "busy" });
  assert.equal(gate.isBusy(), true);
  assert.deepEqual(events, ["first:start"]);
  first.resolve("done");
  assert.deepEqual(await active, { status: "complete", value: "done" });
  assert.equal(gate.isBusy(), false);
  assert.deepEqual(events, ["first:start", "first:end"]);
});

test("the gate reopens after a rejection", async () => {
  const gate = createExclusiveAsyncAction();
  await assert.rejects(
    gate.run(async () => {
      throw new Error("native action failed");
    }),
    /native action failed/,
  );
  assert.deepEqual(await gate.run(async () => 2), {
    status: "complete",
    value: 2,
  });
});
