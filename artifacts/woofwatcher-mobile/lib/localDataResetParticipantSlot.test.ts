import assert from "node:assert/strict";
import { test } from "node:test";

import { createRequiredParticipantSlot } from "./localDataResetParticipantSlot.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a missing required delegate fails closed with an immutable proxy id", async () => {
  const slot = createRequiredParticipantSlot("care");

  assert.equal(slot.participant.id, "care");
  assert.equal(Object.isFrozen(slot.participant), true);
  assert.throws(
    () => Object.assign(slot.participant as object, { id: "forged" }),
    TypeError,
  );
  await assert.rejects(slot.participant.prepare(), /required.*care.*not attached/i);
  await assert.rejects(slot.participant.commit(), /required.*care.*not prepared/i);
});

test("commit uses the same delegate snapshot that successfully prepared", async () => {
  const slot = createRequiredParticipantSlot("care");
  const preparation = deferred<void>();
  const events: string[] = [];
  slot.attach({
    prepare: () => {
      events.push("old:prepare");
      return preparation.promise;
    },
    commit: async () => {
      events.push("old:commit");
    },
  });

  const prepared = slot.participant.prepare();
  slot.attach({
    prepare: async () => {
      events.push("new:prepare");
    },
    commit: async () => {
      events.push("new:commit");
    },
  });
  preparation.resolve();
  await prepared;
  await slot.participant.commit();

  assert.deepEqual(events, ["old:prepare", "old:commit"]);

  await slot.participant.prepare();
  await slot.participant.commit();
  assert.deepEqual(events, [
    "old:prepare",
    "old:commit",
    "new:prepare",
    "new:commit",
  ]);
});

test("commit keeps the prepared method snapshot if the delegate object mutates", async () => {
  const slot = createRequiredParticipantSlot("care");
  const events: string[] = [];
  const delegate = {
    prepare: async () => {
      events.push("prepare");
    },
    commit: async () => {
      events.push("original:commit");
    },
  };
  slot.attach(delegate);

  await slot.participant.prepare();
  delegate.commit = async () => {
    events.push("mutated:commit");
  };
  await slot.participant.commit();

  assert.deepEqual(events, ["prepare", "original:commit"]);
});

test("a stale detach closure cannot clear a newer delegate", async () => {
  const slot = createRequiredParticipantSlot("avatar");
  const events: string[] = [];
  const detachOld = slot.attach({
    prepare: async () => {
      events.push("old:prepare");
    },
    commit: async () => {
      events.push("old:commit");
    },
  });
  slot.attach({
    prepare: async () => {
      events.push("new:prepare");
    },
    commit: async () => {
      events.push("new:commit");
    },
  });

  detachOld();
  await slot.participant.prepare();
  await slot.participant.commit();

  assert.deepEqual(events, ["new:prepare", "new:commit"]);
});

test("a stale detach cannot clear a reattachment of the same delegate object", async () => {
  const slot = createRequiredParticipantSlot("avatar");
  const events: string[] = [];
  const delegate = {
    prepare: async () => {
      events.push("prepare");
    },
    commit: async () => {
      events.push("commit");
    },
  };
  const detachFirstAttachment = slot.attach(delegate);
  slot.attach(delegate);

  detachFirstAttachment();
  await slot.participant.prepare();
  await slot.participant.commit();

  assert.deepEqual(events, ["prepare", "commit"]);
});

test("detaching the current delegate makes the next reset fail closed", async () => {
  const slot = createRequiredParticipantSlot("avatar");
  const detach = slot.attach({
    prepare: async () => {},
    commit: async () => {},
  });

  detach();

  await assert.rejects(slot.participant.prepare(), /required.*avatar.*not attached/i);
});

test("a failed preparation clears any prior prepared delegate", async () => {
  const slot = createRequiredParticipantSlot("care");
  let oldCommitCalls = 0;
  slot.attach({
    prepare: async () => {},
    commit: async () => {
      oldCommitCalls += 1;
    },
  });
  await slot.participant.prepare();

  const failure = new Error("new delegate drain failed");
  slot.attach({
    prepare: async () => {
      throw failure;
    },
    commit: async () => {},
  });
  await assert.rejects(slot.participant.prepare(), (error) => error === failure);
  await assert.rejects(slot.participant.commit(), /required.*care.*not prepared/i);

  assert.equal(oldCommitCalls, 0);
});

test("a synchronous preparation throw rejects without retaining stale state", async () => {
  const slot = createRequiredParticipantSlot("care");
  const failure = new Error("sync preparation failure");
  slot.attach({
    prepare: (() => {
      throw failure;
    }) as () => Promise<void>,
    commit: async () => {},
  });

  await assert.rejects(slot.participant.prepare(), (error) => error === failure);
  await assert.rejects(slot.participant.commit(), /not prepared/i);
});
