import assert from "node:assert/strict";
import { test } from "node:test";

import type { CareState } from "../context/CareContext.tsx";
import { migrateCareDoc } from "./careDocMigration.ts";
import { derivePhoenixStatus } from "./phoenixStatus.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-11T12:00:00-07:00").getTime();

function stateWithRawTime(rawTime: unknown): CareState {
  const routine = migrateCareDoc({
    routines: [{
      id: "legacy-walk",
      label: "Legacy walk",
      type: "walk",
      time: rawTime,
      owner: "Apollo",
      note: "",
    }],
  } as unknown as Record<string, unknown>).routines![0];
  return { routines: [routine], entries: [] } as unknown as CareState;
}

test("Phoenix quarantines every preserved unsafe routine time without crashing Home status", () => {
  for (const rawTime of [
    null,
    ["1:00 PM"],
    1300,
    { hour: 13 },
    " 1:00 PM",
    "1:00 PM ",
    "1:00  PM",
  ]) {
    const status = derivePhoenixStatus(stateWithRawTime(rawTime), NOW);
    assert.equal(status.nextRoutine, null, String(rawTime));
    assert.equal(status.minutesUntilNext, null, String(rawTime));
    assert.equal(status.routineCorrectionCount, 1, String(rawTime));
    assert.equal(status.counts.walks.target, 2, String(rawTime));
  }
});

test("Phoenix still schedules a valid exact clock value", () => {
  const status = derivePhoenixStatus(stateWithRawTime("1:00 PM"), NOW);

  assert.equal(status.nextRoutine?.id, "legacy-walk");
  assert.equal(status.minutesUntilNext, 60);
  assert.equal(status.routineCorrectionCount, 0);
  assert.equal(status.counts.walks.target, 1);
});
