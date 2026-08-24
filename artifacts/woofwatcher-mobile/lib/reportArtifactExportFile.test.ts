import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecordsLocalFileHandoffProofManifest,
  buildReportArtifactExportFilePlan,
  buildReportArtifactShareContent,
  normalizeReportExportFileName,
} from "./reportArtifactExportFile.ts";

test("builds a local printable report export file plan without stale PDF-pending copy", () => {
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
  assert.match(plan.message, /saved inside WoofWatcher/i);
  assert.doesNotMatch(plan.message, /saved to your device/i);
  assert.doesNotMatch(plan.message, /PDF (?:generation )?(?:is still )?pending/i);
  assert.match(plan.message, /stays inside WoofWatcher unless you share it/i);
  assert.match(plan.message, /cloud backup is not included/i);
  assert.doesNotMatch(plan.message, /native.*proof|provider storage|unverified/i);
});

test("names the separately generated PDF while sharing the Care Pass HTML source", () => {
  const plan = buildReportArtifactExportFilePlan(
    {
      fileName: "Phoenix Vet Care Pass.html",
      html: "<!doctype html><html><body>Care pass</body></html>",
      boundary:
        "A generated PDF is available separately; this action shares the printable HTML source. This file stays inside WoofWatcher unless you share it; WoofWatcher cloud backup is not included.",
    },
    {
      documentDirectory: "file:///var/mobile/Documents/",
      title: "Phoenix Vet Care Pass",
    },
  );

  assert.match(plan.message, /generated PDF is available separately/);
  assert.match(plan.message, /shares the printable HTML source/);
  assert.match(plan.message, /stays inside WoofWatcher unless you share it/i);
  assert.match(plan.message, /cloud backup is not included/i);
  assert.doesNotMatch(plan.message, /native.*proof|provider storage|unverified/i);
  assert.doesNotMatch(plan.message, /PDF (?:generation )?(?:is still )?pending/i);
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

test("builds a local SVG credential image source export plan without claiming PNG or PDF output", () => {
  const plan = buildReportArtifactExportFilePlan(
    {
      fileName: "Phoenix Dog ID.svg",
      html: "<svg>Dog ID</svg>",
      mimeType: "image/svg+xml",
      formatLabel: "SVG image source",
      boundary: "PNG and PDF export still need native or provider-backed generation.",
    },
    {
      documentDirectory: "file:///var/mobile/Documents",
      directoryName: "WoofWatcherCredentials",
      printableLabel: "Dog ID SVG image source",
      title: "Phoenix Dog ID",
    },
  );

  assert.equal(plan.fileName, "Phoenix-Dog-ID.svg");
  assert.equal(plan.mimeType, "image/svg+xml");
  assert.match(plan.message, /local SVG image source/);
  assert.match(plan.message, /PNG and PDF export still need/);
});

test("builds a Records local file handoff proof manifest that stays blocked without native evidence", () => {
  const manifest = buildRecordsLocalFileHandoffProofManifest({});

  assert.equal(manifest.title, "Records local file handoff proof manifest");
  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Native file proof blocked");
  assert.equal(manifest.nativeFileProofAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, manifest.totalCount);
  assert.deepEqual(
    manifest.items.map((item) => item.label),
    [
      "Care Pass Report History local HTML",
      "Dog ID local HTML credential",
      "Dog ID SVG image source",
      "Native share sheet behavior",
      "Android content URI or saved-file proof",
      "Fallback copy",
      "Generated PDF/PNG and provider boundary",
    ],
  );
  assert.match(manifest.summary, /Records local files must stay device-verified/);
  assert.match(manifest.blockers.join("\n"), /WoofWatcherReports/);
  assert.match(manifest.blockers.join("\n"), /WoofWatcherCredentials/);
  assert.match(manifest.blockers.join("\n"), /Android content URI/);
  assert.match(manifest.blockers.join("\n"), /fallback copy/);
  assert.match(manifest.blockers.join("\n"), /generated PDF\/PNG proof remains separate/);
});

test("keeps Records local file handoff blocked when native proof uses generic notes without platform-specific files", () => {
  const manifest = buildRecordsLocalFileHandoffProofManifest({
    carePassReportHistoryLocalHtml: "WoofWatcherReports/Phoenix-Care-Pass.html, 12 KB, Saved on this device.",
    dogIdLocalHtmlCredential: "WoofWatcherCredentials/Phoenix-Dog-ID.html shared from Records.",
    dogIdSvgImageSource: "WoofWatcherCredentials/Phoenix-Dog-ID.svg shared as image/svg+xml.",
    nativeShareSheetBehavior: "iOS and Android share sheets opened from Records without dead ends.",
    androidContentUriOrSavedFile: "Android content URI captured from the Records share sheet.",
    fallbackCopy: "Fallback copy names the local-only boundary when file sharing is unavailable.",
    generatedBinaryBoundary: "Generated PDF/PNG proof remains separate until native share/reopen and provider proof exist.",
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.nativeFileProofAllowed, false);
  assert.equal(manifest.readyCount, 5);
  assert.equal(manifest.openCount, 2);
  assert.equal(manifest.items[3]?.status, "blocked");
  assert.equal(manifest.items[4]?.status, "blocked");
  assert.match(manifest.blockers.join("\n"), /iOS Care Pass local HTML/);
  assert.match(manifest.blockers.join("\n"), /Android Dog ID SVG image source/);
});

test("marks Records local file handoff proof ready only when every evidence row is attached", () => {
  const manifest = buildRecordsLocalFileHandoffProofManifest({
    carePassReportHistoryLocalHtml: "WoofWatcherReports/Phoenix-Care-Pass.html, 12 KB, Saved on this device.",
    dogIdLocalHtmlCredential: "WoofWatcherCredentials/Phoenix-Dog-ID.html shared from Records.",
    dogIdSvgImageSource: "WoofWatcherCredentials/Phoenix-Dog-ID.svg shared as image/svg+xml.",
    nativeShareSheetBehavior: "iOS and Android share sheets opened from Records without dead ends.",
    androidContentUriOrSavedFile: "Android content URI captured from the Records share sheet.",
    nativeFileEvidence: [
      {
        platform: "ios",
        artifact: "care-pass-html",
        fileName: "phoenix-care-pass-ios.html",
        uri: "file:///ios/WoofWatcherReports/phoenix-care-pass-ios.html",
        mimeType: "text/html",
        byteSize: 12_288,
        shared: true,
        opened: true,
      },
      {
        platform: "android",
        artifact: "care-pass-html",
        fileName: "phoenix-care-pass-android.html",
        uri: "content://woofwatcher/android/WoofWatcherReports/phoenix-care-pass-android.html",
        mimeType: "text/html",
        byteSize: 12_288,
        shared: true,
        opened: true,
      },
      {
        platform: "ios",
        artifact: "dog-id-html",
        fileName: "phoenix-dog-id-ios.html",
        uri: "file:///ios/WoofWatcherCredentials/phoenix-dog-id-ios.html",
        mimeType: "text/html",
        byteSize: 8_192,
        shared: true,
        opened: true,
      },
      {
        platform: "android",
        artifact: "dog-id-html",
        fileName: "phoenix-dog-id-android.html",
        uri: "content://woofwatcher/android/WoofWatcherCredentials/phoenix-dog-id-android.html",
        mimeType: "text/html",
        byteSize: 8_192,
        shared: true,
        opened: true,
      },
      {
        platform: "ios",
        artifact: "dog-id-svg",
        fileName: "phoenix-dog-id-ios.svg",
        uri: "file:///ios/WoofWatcherCredentials/phoenix-dog-id-ios.svg",
        mimeType: "image/svg+xml",
        byteSize: 4_096,
        shared: true,
        opened: true,
      },
      {
        platform: "android",
        artifact: "dog-id-svg",
        fileName: "phoenix-dog-id-android.svg",
        uri: "content://woofwatcher/android/WoofWatcherCredentials/phoenix-dog-id-android.svg",
        mimeType: "image/svg+xml",
        byteSize: 4_096,
        shared: true,
        opened: true,
      },
    ],
    fallbackCopy: "Fallback copy names the local-only boundary when file sharing is unavailable.",
    generatedBinaryBoundary: "Generated PDF/PNG proof remains separate until native share/reopen and provider proof exist.",
  });

  assert.equal(manifest.status, "ready-for-review");
  assert.equal(manifest.statusLabel, "Native file proof ready for review");
  assert.equal(manifest.nativeFileProofAllowed, true);
  assert.equal(manifest.readyCount, manifest.totalCount);
  assert.equal(manifest.openCount, 0);
  assert.deepEqual(manifest.blockers, []);
  assert.match(manifest.items[2]?.evidenceAttached.join("\n") ?? "", /image\/svg\+xml/);
  assert.match(manifest.items[3]?.evidenceAttached.join("\n") ?? "", /6\/6 native file proofs ready/);
  assert.match(manifest.items[4]?.evidenceAttached.join("\n") ?? "", /3\/3 Android URI proofs ready/);
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
