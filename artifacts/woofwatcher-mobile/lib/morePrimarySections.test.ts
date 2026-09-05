import assert from "node:assert/strict";
import test from "node:test";

test("orders primary More sections for each surface policy", async () => {
  const module = await import("./morePrimarySections.ts").catch(() => null);
  assert.ok(module, "the primary More section policy must exist");

  const cases = [
    { ownerOps: false, expected: ["directory", "career"] },
    { ownerOps: true, expected: ["career", "directory"] },
  ] as const;

  for (const { ownerOps, expected } of cases) {
    assert.deepEqual(module.getMorePrimarySectionOrder(ownerOps), expected);
  }
});
