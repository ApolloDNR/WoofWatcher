import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { persistSetupFoundation } from "./setupFoundationSave.ts";

const setupSource = readFileSync(
  fileURLToPath(new URL("../app/setup.tsx", import.meta.url)),
  "utf8",
);

test("setup reports complete only after care and twin persistence complete in order", async () => {
  const events: string[] = [];
  const result = await persistSetupFoundation({
    updateCare() {
      events.push("care:update");
      return true;
    },
    async persistCare() {
      events.push("care:persist");
      return true;
    },
    async persistTwin() {
      events.push("twin:persist");
    },
  });

  assert.deepEqual(result, { status: "complete" });
  assert.deepEqual(events, ["care:update", "care:persist", "twin:persist"]);
});

test("setup never starts or claims the twin when care was rejected or not durable", async () => {
  let twinWrites = 0;
  const rejected = await persistSetupFoundation({
    updateCare: () => false,
    persistCare: async () => {
      throw new Error("must not run");
    },
    persistTwin: async () => {
      twinWrites += 1;
    },
  });
  const notDurable = await persistSetupFoundation({
    updateCare: () => true,
    persistCare: async () => false,
    persistTwin: async () => {
      twinWrites += 1;
    },
  });

  assert.deepEqual(rejected, { status: "care-rejected" });
  assert.deepEqual(notDurable, { status: "care-persistence-failed" });
  assert.equal(twinWrites, 0);
});

test("setup exposes avatar persistence failure as a partial result", async () => {
  const result = await persistSetupFoundation({
    updateCare: () => true,
    persistCare: async () => true,
    persistTwin: async () => {
      throw new Error("avatar storage unavailable");
    },
  });

  assert.deepEqual(result, { status: "twin-persistence-failed" });
});

test("Setup gates duplicate saves, waits for durable care and twin work, and freezes editing", () => {
  assert.match(setupSource, /createExclusiveAsyncAction/);
  assert.match(
    setupSource,
    /saveGateRef\.current\.run\([\s\S]*persistSetupFoundation\([\s\S]*persistCare:\s*persistCurrentCareSnapshot[\s\S]*persistTwin:/,
  );
  assert.match(setupSource, /gated\.value\.status === "twin-persistence-failed"/);
  assert.match(setupSource, /Profile saved; twin unchanged/);
  assert.match(setupSource, /editable=\{!controlsDisabled\}/);
  assert.match(setupSource, /disabled=\{controlsDisabled\}/);
  assert.match(setupSource, /Loading saved care/);
  assert.doesNotMatch(
    setupSource,
    /saveAvatarConfig\([\s\S]{0,260}\.catch\(\(\) => \{\}\)/,
  );
});
