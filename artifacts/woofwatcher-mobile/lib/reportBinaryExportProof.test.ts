import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReportBinaryExportProofManifest,
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

test("builds an artifact-specific binary export readiness manifest without claiming PDF or PNG generation", () => {
  const manifest = buildReportBinaryExportProofManifest({
    carePassHtmlFileName: "phoenix-vet-care-pass-2026-06-08.html",
    dogIdSvgFileName: "phoenix-dog-id-2026-06-08.svg",
    storageProviderConfigured: false,
    pdfGeneratorApproved: false,
    pngRendererApproved: false,
    nativeArtifactEvidenceApproved: false,
  });

  assert.equal(manifest.status, "blocked");
  assert.deepEqual(
    manifest.rows.map((row) => row.label),
    ["Care Pass PDF", "Dog ID PNG", "Provider storage", "Native artifact proof"],
  );
  assert.equal(manifest.rows[0]?.value, "PDF pending");
  assert.match(manifest.rows[0]?.detail ?? "", /phoenix-vet-care-pass-2026-06-08\.html/);
  assert.match(manifest.rows[0]?.detail ?? "", /application\/pdf/);
  assert.match(manifest.rows[0]?.detail ?? "", /approved PDF generator/);
  assert.equal(manifest.rows[1]?.value, "PNG pending");
  assert.match(manifest.rows[1]?.detail ?? "", /phoenix-dog-id-2026-06-08\.svg/);
  assert.match(manifest.rows[1]?.detail ?? "", /image\/png/);
  assert.match(manifest.rows[1]?.detail ?? "", /approved PNG renderer/);
  assert.equal(manifest.rows[2]?.value, "Provider storage pending");
  assert.equal(manifest.rows[3]?.value, "iOS/Android proof pending");
  assert.ok(manifest.blockers.some((blocker) => /Care Pass PDF generator/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Dog ID PNG renderer/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Provider storage/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /iOS and Android/i.test(blocker)));
});

test("shows generated local binary artifacts while keeping native and provider proof blocked", () => {
  const manifest = buildReportBinaryExportProofManifest({
    carePassHtmlFileName: "phoenix-vet-care-pass-2026-06-08.html",
    dogIdSvgFileName: "phoenix-dog-id-2026-06-08.svg",
    generatedCarePassPdf: {
      fileName: "phoenix-vet-care-pass-2026-06-08.pdf",
      mimeType: "application/pdf",
      byteSize: 2048,
    },
    generatedDogIdPng: {
      fileName: "phoenix-dog-id-2026-06-08.png",
      mimeType: "image/png",
      byteSize: 4096,
    },
    storageProviderConfigured: false,
    pdfGeneratorApproved: false,
    pngRendererApproved: false,
    nativeArtifactEvidenceApproved: false,
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.rows[0]?.value, "Local PDF generated");
  assert.match(manifest.rows[0]?.detail ?? "", /2048 bytes/);
  assert.match(manifest.rows[0]?.detail ?? "", /native share and reopen proof still required/i);
  assert.equal(manifest.rows[1]?.value, "Local PNG generated");
  assert.match(manifest.rows[1]?.detail ?? "", /4096 bytes/);
  assert.match(manifest.rows[1]?.detail ?? "", /provider storage proof still pending/i);
  assert.ok(!manifest.blockers.some((blocker) => /PDF generator needs/i.test(blocker)));
  assert.ok(!manifest.blockers.some((blocker) => /PNG renderer needs/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Provider storage/i.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /iOS and Android/i.test(blocker)));
});
