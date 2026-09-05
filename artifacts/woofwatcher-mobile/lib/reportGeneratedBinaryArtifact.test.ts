import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCarePassPdfArtifactSource,
  buildDogIdPngArtifactSource,
  buildGeneratedBinaryArtifactFilePlan,
  buildGeneratedBinaryArtifactShareContent,
} from "./reportGeneratedBinaryArtifact.ts";

test("builds a real local Care Pass PDF source without claiming native proof", () => {
  const source = buildCarePassPdfArtifactSource({
    fileName: "Phoenix Vet Care Pass: 2026/07/03.html",
    title: "Phoenix Vet Care Pass",
    summary: "Health and care context for veterinarian review.",
    message: "Meals steady\nMedication due tonight\nNot veterinary advice.",
  });
  const bytes = Buffer.from(source.contentBase64, "base64");

  assert.equal(source.fileName, "Phoenix-Vet-Care-Pass-2026-07-03.pdf");
  assert.equal(source.mimeType, "application/pdf");
  assert.equal(source.encoding, "base64");
  assert.equal(source.formatLabel, "Generated PDF");
  assert.ok(source.byteSize > 400);
  assert.equal(source.byteSize, bytes.byteLength);
  assert.equal(bytes.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.match(bytes.toString("latin1"), /Phoenix Vet Care Pass/);
  assert.match(source.boundary, /native share\/reopen proof still required/i);
  assert.match(source.boundary, /provider storage is not enabled/i);
});

test("builds a real Dog ID PNG source with credential metadata and launch boundaries", () => {
  const source = buildDogIdPngArtifactSource({
    fileName: "Phoenix Dog ID.svg",
    title: "Phoenix Dog ID",
    lines: [
      "Breed: American Bully",
      "Weight: 62 lb",
      "Microchip: 981020000000000",
      "Emergency: Apollo",
    ],
  });
  const bytes = Buffer.from(source.contentBase64, "base64");

  assert.equal(source.fileName, "Phoenix-Dog-ID.png");
  assert.equal(source.mimeType, "image/png");
  assert.equal(source.encoding, "base64");
  assert.equal(source.formatLabel, "Generated PNG");
  assert.ok(source.byteSize > 1200);
  assert.equal(source.byteSize, bytes.byteLength);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(bytes.toString("latin1"), /Phoenix Dog ID/);
  assert.match(bytes.toString("latin1"), /Microchip: 981020000000000/);
  assert.match(source.boundary, /native share\/reopen proof still required/i);
});

test("builds a local generated binary file plan for native sharing and web fallback", () => {
  const source = buildCarePassPdfArtifactSource({
    fileName: "vet-care-pass.html",
    title: "Vet Care Pass",
    summary: "Review packet.",
    message: "Review before sharing.",
  });
  const plan = buildGeneratedBinaryArtifactFilePlan(source, {
    documentDirectory: "file:///var/mobile/Documents",
    directoryName: "WoofWatcherReports",
    title: "Vet Care Pass",
  });

  assert.equal(plan.canWriteLocalFile, true);
  assert.equal(plan.directoryUri, "file:///var/mobile/Documents/WoofWatcherReports/");
  assert.equal(plan.fileUri, "file:///var/mobile/Documents/WoofWatcherReports/vet-care-pass.pdf");
  assert.equal(plan.encoding, "base64");
  assert.match(plan.message, /local generated PDF/);
  assert.match(plan.message, /native share\/reopen proof still required/i);

  const shareContent = buildGeneratedBinaryArtifactShareContent(plan, {
    shareUri: "content://reports/vet-care-pass.pdf",
  });
  assert.equal(shareContent.url, "content://reports/vet-care-pass.pdf");
  assert.equal(shareContent.mimeType, "application/pdf");
  assert.equal(shareContent.dialogTitle, "Vet Care Pass generated pdf");
  assert.match(shareContent.message, /application\/pdf/);

  const fallback = buildGeneratedBinaryArtifactFilePlan(source, {
    documentDirectory: null,
    title: "Vet Care Pass",
  });
  assert.equal(fallback.canWriteLocalFile, false);
  assert.equal(buildGeneratedBinaryArtifactShareContent(fallback).url, undefined);
  assert.match(buildGeneratedBinaryArtifactShareContent(fallback).message, /local file export is unavailable/i);
});
