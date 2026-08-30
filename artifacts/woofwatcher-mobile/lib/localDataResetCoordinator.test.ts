import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createLocalDataResetCoordinator,
  type LocalDataResetParticipant,
} from "./localDataResetCoordinator.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("prepares every participant before committing in deterministic id order", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const alphaPrepared = deferred<void>();
  const betaPrepared = deferred<void>();
  const events: string[] = [];

  coordinator.register({
    id: "beta",
    prepare: () => {
      events.push("prepare:beta");
      return betaPrepared.promise;
    },
    commit: async () => {
      events.push("commit:beta");
    },
  });
  coordinator.register({
    id: "alpha",
    prepare: () => {
      events.push("prepare:alpha");
      return alphaPrepared.promise;
    },
    commit: async () => {
      events.push("commit:alpha");
    },
  });

  const reset = coordinator.run();
  assert.deepEqual(events, ["prepare:alpha", "prepare:beta"]);

  betaPrepared.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ["prepare:alpha", "prepare:beta"]);

  alphaPrepared.resolve();
  const result = await reset;

  assert.deepEqual(events, [
    "prepare:alpha",
    "prepare:beta",
    "commit:alpha",
    "commit:beta",
  ]);
  assert.deepEqual(result, {
    status: "complete",
    committedParticipantIds: ["alpha", "beta"],
    failedParticipantIds: [],
  });
});

test("rejects a duplicate live participant id", () => {
  const coordinator = createLocalDataResetCoordinator();
  const participant: LocalDataResetParticipant = {
    id: "care",
    prepare: async () => {},
    commit: async () => {},
  };
  coordinator.register(participant);

  assert.throws(
    () => coordinator.register({ ...participant }),
    /participant.*care.*already registered/i,
  );
});

test("a preparation failure prevents every commit and reports exact failed ids", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];

  coordinator.register({
    id: "avatar",
    prepare: async () => {
      events.push("prepare:avatar");
      throw new Error("avatar queue did not drain");
    },
    commit: async () => {
      events.push("commit:avatar");
    },
  });
  coordinator.register({
    id: "care",
    prepare: (() => {
      events.push("prepare:care");
      throw new Error("care preparation threw synchronously");
    }) as LocalDataResetParticipant["prepare"],
    commit: async () => {
      events.push("commit:care");
    },
  });
  coordinator.register({
    id: "files",
    prepare: async () => {
      events.push("prepare:files");
    },
    commit: async () => {
      events.push("commit:files");
    },
  });

  const result = await coordinator.run();

  assert.deepEqual(events, ["prepare:avatar", "prepare:care", "prepare:files"]);
  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: [],
    failedParticipantIds: ["avatar", "care"],
  });
});

test("continues sequential commits after a failure and reports exact ids", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];

  for (const id of ["care", "avatar", "files"]) {
    coordinator.register({
      id,
      prepare: async () => {},
      commit: async () => {
        events.push(`commit:${id}`);
        if (id === "care") throw new Error("remove failed");
      },
    });
  }

  const result = await coordinator.run();

  assert.deepEqual(events, ["commit:avatar", "commit:care", "commit:files"]);
  assert.deepEqual(result, {
    status: "partial-failure",
    committedParticipantIds: ["avatar", "files"],
    failedParticipantIds: ["care"],
  });
});

test("a stale unregister closure cannot delete a later replacement", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  const unregisterOld = coordinator.register({
    id: "care",
    prepare: async () => {
      events.push("old:prepare");
    },
    commit: async () => {
      events.push("old:commit");
    },
  });

  unregisterOld();
  coordinator.register({
    id: "care",
    prepare: async () => {
      events.push("new:prepare");
    },
    commit: async () => {
      events.push("new:commit");
    },
  });
  unregisterOld();

  await coordinator.run();

  assert.deepEqual(events, ["new:prepare", "new:commit"]);
});

test("registration captures the id so later participant mutation cannot defeat unregister", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  const participant: LocalDataResetParticipant = {
    id: "care",
    prepare: async () => {
      events.push("prepare");
    },
    commit: async () => {
      events.push("commit");
    },
  };
  const unregister = coordinator.register(participant);

  participant.id = "mutated-after-registration";
  unregister();
  await coordinator.run();

  assert.deepEqual(events, []);
});

test("reset ordering and failure ids use the id captured at registration", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  const participant: LocalDataResetParticipant = {
    id: "care",
    prepare: async () => {
      events.push("prepare:care");
    },
    commit: async () => {
      throw new Error("care removal failed");
    },
  };
  coordinator.register(participant);
  participant.id = "zzz-mutated";
  coordinator.register({
    id: "avatar",
    prepare: async () => {
      events.push("prepare:avatar");
    },
    commit: async () => {},
  });

  const result = await coordinator.run();

  assert.deepEqual(events, ["prepare:avatar", "prepare:care"]);
  assert.deepEqual(result.failedParticipantIds, ["care"]);
});

test("concurrent callers receive the exact same in-flight reset promise", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const preparation = deferred<void>();
  coordinator.register({
    id: "care",
    prepare: () => preparation.promise,
    commit: async () => {},
  });

  const first = coordinator.run();
  const second = coordinator.run();

  assert.strictEqual(second, first);

  preparation.resolve();
  await first;
});

test("a reset re-entered during preparation receives the exact outer promise", async () => {
  const coordinator = createLocalDataResetCoordinator();
  let prepareCalls = 0;
  let didReenter = false;
  let reentered: Promise<unknown> | undefined;
  coordinator.register({
    id: "care",
    prepare: async () => {
      prepareCalls += 1;
      if (!didReenter) {
        didReenter = true;
        reentered = coordinator.run();
      }
    },
    commit: async () => {},
  });

  const outer = coordinator.run();

  assert.equal(prepareCalls, 1);
  assert.strictEqual(reentered, outer);
  await outer;
});

test("a reset re-entered during commit receives the exact outer promise", async () => {
  const coordinator = createLocalDataResetCoordinator();
  let commitCalls = 0;
  let reentered: Promise<unknown> | undefined;
  coordinator.register({
    id: "care",
    prepare: async () => {},
    commit: async () => {
      commitCalls += 1;
      reentered = coordinator.run();
    },
  });

  const outer = coordinator.run();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(commitCalls, 1);
  assert.strictEqual(reentered, outer);
  await outer;
});

test("invokes a synchronous barrier once after all preparations and before the first commit", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  for (const id of ["care", "avatar"]) {
    coordinator.register({
      id,
      prepare: async () => {
        events.push(`prepare:${id}`);
      },
      commit: async () => {
        events.push(`commit:${id}`);
      },
    });
  }

  await coordinator.run(() => {
    events.push("barrier");
  });

  assert.deepEqual(events, [
    "prepare:avatar",
    "prepare:care",
    "barrier",
    "commit:avatar",
    "commit:care",
  ]);
});

test("a preparation failure skips the barrier and every commit", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  coordinator.register({
    id: "care",
    prepare: async () => {
      events.push("prepare");
      throw new Error("drain failed");
    },
    commit: async () => {
      events.push("commit");
    },
  });

  const result = await coordinator.run(() => {
    events.push("barrier");
  });

  assert.equal(result.status, "partial-failure");
  assert.deepEqual(events, ["prepare"]);
});

test("a throwing barrier rejects the run before any commit", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const events: string[] = [];
  const barrierFailure = new Error("permit invalidation failed");
  coordinator.register({
    id: "care",
    prepare: async () => {
      events.push("prepare");
    },
    commit: async () => {
      events.push("commit");
    },
  });

  await assert.rejects(
    coordinator.run(() => {
      events.push("barrier");
      throw barrierFailure;
    }),
    (error) => error === barrierFailure,
  );

  assert.deepEqual(events, ["prepare", "barrier"]);
});

test("concurrent and re-entered calls use the first accepted barrier", async () => {
  const coordinator = createLocalDataResetCoordinator();
  const barriers: string[] = [];
  let reentered: Promise<unknown> | undefined;
  coordinator.register({
    id: "care",
    prepare: async () => {
      reentered = coordinator.run(() => {
        barriers.push("reentered");
      });
    },
    commit: async () => {},
  });

  const first = coordinator.run(() => {
    barriers.push("first");
  });
  const concurrent = coordinator.run(() => {
    barriers.push("concurrent");
  });

  assert.strictEqual(reentered, first);
  assert.strictEqual(concurrent, first);
  await first;
  assert.deepEqual(barriers, ["first"]);
});
