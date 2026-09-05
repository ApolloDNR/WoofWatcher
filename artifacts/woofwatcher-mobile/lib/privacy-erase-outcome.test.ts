import assert from "node:assert/strict";
import test from "node:test";

import { derivePrivacyEraseStage } from "./privacy-erase-outcome.ts";

const erased = { status: "fulfilled", value: "erased" } as const;
const superseded = { status: "fulfilled", value: "superseded" } as const;
const rejected = {
  status: "rejected",
  reason: new Error("storage failed"),
} as const;

test("privacy reports done only when both exact local erase operations finish", () => {
  assert.equal(derivePrivacyEraseStage(erased, erased), "done");
});

test("privacy reports cancellation when either erase is superseded", () => {
  assert.equal(derivePrivacyEraseStage(superseded, erased), "cancelled");
  assert.equal(derivePrivacyEraseStage(erased, superseded), "cancelled");
  assert.equal(derivePrivacyEraseStage(superseded, superseded), "cancelled");
});

test("privacy reports failure when either erase rejects", () => {
  assert.equal(derivePrivacyEraseStage(rejected, erased), "failed");
  assert.equal(derivePrivacyEraseStage(erased, rejected), "failed");
  assert.equal(derivePrivacyEraseStage(rejected, superseded), "failed");
});
