import assert from "node:assert/strict";
import { test } from "node:test";

import type { AppFileSystem } from "./appFileSystem.ts";
import {
  runGeneratedRecordsFileShare,
  runPrintableRecordsFileShare,
} from "./recordsFileShareActions.ts";

function savedFileSystem(): AppFileSystem {
  const intent = Object.freeze({}) as NonNullable<
    ReturnType<AppFileSystem["captureIntent"]>
  >;
  return {
    platform: "android",
    captureIntent: () => intent,
    isIntentCurrent: () => true,
    getDocumentDirectoryForArtifactPlanning: () => "file:///documents/",
    inspect: async () => "exists",
    listOwnedFiles: async () => ({ status: "complete", fileCount: 0 }),
    resolveOwnedDocumentUri: (uri) => uri,
    runProtectedPicker: async (_intent, pick) => ({
      status: "complete",
      value: await pick(),
    }),
    persistPickedMedia: async () => ({
      ok: false,
      reason: "durable-storage-unavailable",
    }),
    discardPickedMedia: async () => ({ ok: true }),
    runProtectedShare: async (_intent, artifact, perform) => ({
      status: "complete",
      value: await perform({
        ok: true,
        fileUri: `file:///documents/WoofWatcherReports/${artifact.fileName}`,
        shareUri: `content://woofwatcher/${artifact.fileName}`,
      }),
    }),
    localDataResetParticipant: {
      prepare: async () => {},
      commit: async () => {},
    },
  } as AppFileSystem;
}

function unavailableFileSystem(): AppFileSystem {
  const base = savedFileSystem();
  return {
    ...base,
    getDocumentDirectoryForArtifactPlanning: () => null,
    runProtectedShare: async (_intent, _artifact, perform) => ({
      status: "complete",
      value: await perform({ ok: false, reason: "storage-unavailable" }),
    }),
  } as AppFileSystem;
}

test("printable native attachment failure falls back truthfully after the file was saved", async () => {
  const fallbackMessages: string[] = [];
  const result = await runPrintableRecordsFileShare({
    appFileSystem: savedFileSystem(),
    destination: "reports",
    printable: {
      fileName: "care-pass.html",
      html: "<html><body><h1>Care Pass</h1></body></html>",
      fallbackText: "Care Pass\nMeals: Breakfast completed",
    },
    title: "Phoenix Care Pass",
    shareNative: async () => {
      throw new Error("Android URL attachment unsupported");
    },
    shareText: async (payload) => {
      fallbackMessages.push(payload.message);
      return "shared";
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(fallbackMessages.length, 1);
  assert.match(fallbackMessages[0], /saved inside WoofWatcher/i);
  assert.doesNotMatch(fallbackMessages[0], /saved to your device/i);
  assert.match(fallbackMessages[0], /could not be attached/i);
  assert.doesNotMatch(fallbackMessages[0], /local file export is unavailable/i);
  assert.match(fallbackMessages[0], /Meals: Breakfast completed/);
  assert.doesNotMatch(fallbackMessages[0], /<\/?(?:html|body|h1)>/i);
});

test("generated native attachment failure reports the saved PDF without claiming attachment", async () => {
  const fallbackMessages: string[] = [];
  await runGeneratedRecordsFileShare({
    appFileSystem: savedFileSystem(),
    destination: "reports",
    source: {
      fileName: "care-pass.pdf",
      mimeType: "application/pdf",
      formatLabel: "Generated PDF",
      encoding: "base64",
      contentBase64: "cGRm",
      byteSize: 3,
      boundary: "Local generated PDF.",
    },
    title: "Phoenix Care Pass",
    shareNative: async () => {
      throw new Error("Android URL attachment unsupported");
    },
    shareText: async (payload) => {
      fallbackMessages.push(payload.message);
      return "shared";
    },
  });

  assert.equal(fallbackMessages.length, 1);
  assert.match(fallbackMessages[0], /saved inside WoofWatcher as care-pass\.pdf/i);
  assert.doesNotMatch(fallbackMessages[0], /saved to your device/i);
  assert.match(fallbackMessages[0], /could not be attached/i);
  assert.doesNotMatch(fallbackMessages[0], /local file export is unavailable/i);
});

test("generated write failure never claims that an unavailable file was saved or attached", async () => {
  const fallbackMessages: string[] = [];
  let nativeShareCalls = 0;
  const result = await runGeneratedRecordsFileShare({
    appFileSystem: unavailableFileSystem(),
    destination: "reports",
    source: {
      fileName: "care-pass.pdf",
      mimeType: "application/pdf",
      formatLabel: "Generated PDF",
      encoding: "base64",
      contentBase64: "cGRm",
      byteSize: 3,
      boundary: "Native proof remains open.",
    },
    title: "Care Pass",
    shareNative: async () => {
      nativeShareCalls += 1;
      return "shared";
    },
    shareText: async (payload) => {
      fallbackMessages.push(payload.message);
      return "shared";
    },
  });

  assert.deepEqual(result, { status: "complete", outcome: "shared" });
  assert.equal(nativeShareCalls, 0);
  assert.equal(fallbackMessages.length, 1);
  assert.match(fallbackMessages[0], /local file export is unavailable/i);
  assert.match(fallbackMessages[0], /could not be saved or attached/i);
  assert.doesNotMatch(fallbackMessages[0], /saved to your device/i);
  assert.doesNotMatch(fallbackMessages[0], /could not be attached by this share sheet/i);
});

test("a dismissed iOS file share stays canceled and does not open a text fallback", async () => {
  let fallbackCalls = 0;
  const result = await runGeneratedRecordsFileShare({
    appFileSystem: savedFileSystem(),
    destination: "reports",
    source: {
      fileName: "care-pass.pdf",
      mimeType: "application/pdf",
      formatLabel: "Generated PDF",
      encoding: "base64",
      contentBase64: "cGRm",
      byteSize: 3,
      boundary: "Local generated PDF.",
    },
    title: "Phoenix Care Pass",
    shareNative: async () => "dismissed" as const,
    shareText: async () => {
      fallbackCalls += 1;
      return "shared";
    },
  });

  assert.deepEqual(result, { status: "dismissed" });
  assert.equal(fallbackCalls, 0);
});
