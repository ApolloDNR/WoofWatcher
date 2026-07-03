import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReportArtifactExportFilePlan,
  buildReportArtifactShareContent,
  normalizeReportExportFileName,
} from "./reportArtifactExportFile.ts";

test("builds a local printable report export file plan without claiming PDF output", () => {
  const plan = buildReportArtifactExportFilePlan(
    {
      fileName: "Phoenix Vet Care Pass: 2026/07/03.html",
      html: "<!doctype html><html><body>Care pass</body></html>",
    },
    {
      documentDirectory: "file:///var/mobile/Containers/Data/Application/WoofWatcher/Documents/",
      title: "Phoenix Vet Care Pass",
    },
  );

  assert.equal(plan.canWriteLocalFile, true);
  assert.equal(plan.directoryUri, "file:///var/mobile/Containers/Data/Application/WoofWatcher/Documents/WoofWatcherReports/");
  assert.equal(plan.fileName, "Phoenix-Vet-Care-Pass-2026-07-03.html");
  assert.equal(
    plan.fileUri,
    "file:///var/mobile/Containers/Data/Application/WoofWatcher/Documents/WoofWatcherReports/Phoenix-Vet-Care-Pass-2026-07-03.html",
  );
  assert.equal(plan.mimeType, "text/html");
  assert.equal(plan.shareTitle, "Phoenix Vet Care Pass printable source");
  assert.match(plan.message, /local HTML file/);
  assert.match(plan.message, /PDF generation is still pending/);
  assert.match(plan.message, /cloud storage is not enabled/);
});

test("builds a local printable credential export file plan without calling it a report", () => {
  const plan = buildReportArtifactExportFilePlan(
    {
      fileName: "Phoenix Dog ID: microchip/insurance.html",
      html: "<!doctype html><html><body>Dog ID</body></html>",
    },
    {
      documentDirectory: "file:///var/mobile/Documents",
      directoryName: "WoofWatcherCredentials",
      printableLabel: "Dog ID credential source",
      title: "Phoenix Dog ID",
    },
  );

  assert.equal(plan.directoryUri, "file:///var/mobile/Documents/WoofWatcherCredentials/");
  assert.equal(plan.fileName, "Phoenix-Dog-ID-microchip-insurance.html");
  assert.equal(plan.fileUri, "file:///var/mobile/Documents/WoofWatcherCredentials/Phoenix-Dog-ID-microchip-insurance.html");
  assert.match(plan.message, /Dog ID credential source/);
  assert.doesNotMatch(plan.message, /report source/);
});

test("falls back to inline printable source when a local file directory is unavailable", () => {
  const plan = buildReportArtifactExportFilePlan(
    {
      fileName: "vet-care-pass",
      html: "<!doctype html><html><body>Care pass</body></html>",
    },
    {
      documentDirectory: null,
      title: "Vet Care Pass",
    },
  );
  const shareContent = buildReportArtifactShareContent(plan);

  assert.equal(plan.canWriteLocalFile, false);
  assert.equal(plan.fileName, "vet-care-pass.html");
  assert.equal(plan.directoryUri, null);
  assert.equal(plan.fileUri, null);
  assert.match(plan.fallbackReason ?? "", /Local file export is unavailable/);
  assert.equal(shareContent.url, undefined);
  assert.match(shareContent.message, /printable report source is included below/);
  assert.match(shareContent.message, /Care pass/);
});

test("normalizes unsafe report export filenames for device storage", () => {
  assert.equal(normalizeReportExportFileName("  Phoenix/Vet:*? Pass  "), "Phoenix-Vet-Pass.html");
  assert.equal(normalizeReportExportFileName(""), "woofwatcher-report.html");
});
