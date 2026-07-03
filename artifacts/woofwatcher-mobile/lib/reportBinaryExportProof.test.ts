import { test } from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_BINARY_EXPORT_PROOF_ITEMS,
  REPORT_BINARY_EXPORT_PROOF_SUMMARY,
} from "./reportBinaryExportProof.ts";

test("defines the binary report export proof packet before PDF or PNG readiness can be claimed", () => {
  assert.match(REPORT_BINARY_EXPORT_PROOF_SUMMARY, /Report binary export proof packet/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_SUMMARY, /Care Pass PDF/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_SUMMARY, /Dog ID PNG/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_SUMMARY, /provider storage/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_SUMMARY, /iOS\/Android artifact proof/);

  assert.deepEqual(
    REPORT_BINARY_EXPORT_PROOF_ITEMS.map((item) => item.label),
    [
      "PDF generator",
      "Credential PNG generator",
      "Provider storage handoff",
      "Native artifact proof",
    ],
  );
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[0].requiredEvidence, /expo-print/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[0].requiredEvidence, /Care Pass Report History/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[1].requiredEvidence, /view-shot|server renderer/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[1].requiredEvidence, /Dog ID PNG/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[2].requiredEvidence, /signed upload/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[2].requiredEvidence, /retention\/export\/deletion/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[3].requiredEvidence, /iOS and Android/);
  assert.match(REPORT_BINARY_EXPORT_PROOF_ITEMS[3].requiredEvidence, /PDF and PNG/);
});
