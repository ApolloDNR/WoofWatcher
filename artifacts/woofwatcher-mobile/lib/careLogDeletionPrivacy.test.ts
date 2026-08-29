import assert from "node:assert/strict";
import test from "node:test";

import { runCareLogDeletionWithoutSharedAudit } from "./careLogDeletionPrivacy.ts";

test("cross-device and unknown deletion outcomes never gain a shared audit capability", async () => {
  const scenarios = [
    {
      label: "A cached shared, B privatized, A received normalized 404 success",
      mutationResult: { authorityStatus: 404, accepted: true },
    },
    {
      label: "creator stale device deleted a row that is now private",
      mutationResult: { authorityStatus: 204, accepted: true },
    },
    {
      label: "provider outcome is unknown",
      mutationResult: { authorityStatus: "unknown", accepted: false },
    },
  ] as const;

  for (const scenario of scenarios) {
    const result = await runCareLogDeletionWithoutSharedAudit({
      deleteEntry: async () => scenario.mutationResult,
    });

    assert.equal(result.sharedAuditEntry, null, scenario.label);
    assert.equal(result.mutationResult, scenario.mutationResult, scenario.label);
  }
});

test("the deletion boundary cannot receive a stale cached entry or an audit writer", async () => {
  let deletes = 0;
  const result = await runCareLogDeletionWithoutSharedAudit({
    deleteEntry: async () => {
      deletes += 1;
      return true;
    },
  });

  assert.equal(deletes, 1);
  assert.deepEqual(result, { mutationResult: true, sharedAuditEntry: null });
});
