import assert from "node:assert/strict";
import { test } from "node:test";

import { runDurableCarePassSaveShare } from "./recordsCarePassSaveShare.ts";

test("Care Pass waits for durable persistence before opening the share sheet", async () => {
  const events: string[] = [];
  const result = await runDurableCarePassSaveShare({
    save: () => {
      events.push("save");
      return true;
    },
    persist: async () => {
      events.push("persist:start");
      await Promise.resolve();
      events.push("persist:confirmed");
      return true;
    },
    rollback: () => {
      events.push("rollback");
      return true;
    },
    persistRollback: async () => {
      events.push("persist-rollback");
      return true;
    },
    share: async () => {
      events.push("share");
      return "shared";
    },
  });

  assert.deepEqual(events, ["save", "persist:start", "persist:confirmed", "share"]);
  assert.deepEqual(result, { status: "shared", outcome: "shared" });
});

test("Care Pass persistence failure rolls back live history and never shares", async () => {
  const events: string[] = [];
  const result = await runDurableCarePassSaveShare({
    save: () => {
      events.push("save");
      return true;
    },
    persist: async () => {
      events.push("persist");
      return false;
    },
    rollback: () => {
      events.push("rollback");
      return true;
    },
    persistRollback: async () => {
      events.push("persist-rollback");
      return true;
    },
    share: async () => {
      events.push("share");
      return "shared";
    },
  });

  assert.deepEqual(events, ["save", "persist", "rollback", "persist-rollback"]);
  assert.deepEqual(result, {
    status: "save-failed",
    reason: "persistence-failed",
    rollback: "durable-complete",
  });
});

test("Care Pass reports rollback failure without claiming save or share success", async () => {
  const result = await runDurableCarePassSaveShare({
    save: () => true,
    persist: async () => {
      throw new Error("device storage unavailable");
    },
    rollback: () => false,
    persistRollback: async () => true,
    share: async () => "shared",
  });

  assert.deepEqual(result, {
    status: "save-failed",
    reason: "persistence-failed",
    rollback: "partial-failure",
    rollbackReason: "mutation-rejected",
  });
});

test("Care Pass does not claim removal when rollback persistence is unconfirmed", async () => {
  for (const persistRollback of [
    async () => false,
    async () => {
      throw new Error("rollback persistence unavailable");
    },
  ]) {
    const result = await runDurableCarePassSaveShare({
      save: () => true,
      persist: async () => false,
      rollback: () => true,
      persistRollback,
      share: async () => "shared",
    });

    assert.deepEqual(result, {
      status: "save-failed",
      reason: "persistence-failed",
      rollback: "partial-failure",
      rollbackReason: "persistence-unconfirmed",
    });
  }
});

test("Care Pass distinguishes a durable preset from a dismissed or failed share", async () => {
  for (const outcome of ["dismissed", "failed"] as const) {
    const result = await runDurableCarePassSaveShare({
      save: () => true,
      persist: async () => true,
      rollback: () => true,
      persistRollback: async () => true,
      share: async () => outcome,
    });

    assert.deepEqual(result, { status: "saved-not-shared", outcome });
  }
});
