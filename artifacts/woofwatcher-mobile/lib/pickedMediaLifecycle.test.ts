import assert from "node:assert/strict";
import { test } from "node:test";

import type { AppFileSystem } from "./appFileSystem.ts";
import {
  cancelPickedMediaDraft,
  clearPickedMediaEvidence,
  commitPickedMediaDraft,
  createPickedMediaDraft,
  isPickedMediaDraftSettlementCurrent,
  releasePickedMediaReferences,
  runPickedMediaEvidenceClear,
  settlePickedMediaDraftRelease,
  stagePickedMediaDraft,
} from "./pickedMediaLocalDataActions.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("delayed attachment cleanup cannot settle into a closed or replacement form session", async () => {
  const cleanup = deferred();
  const pendingDraft = createPickedMediaDraft(
    "file:///documents/woofwatcher-attachments/old.jpg",
  );
  let currentDraft = pendingDraft;
  let currentSession = 4;
  let formOpen = true;

  const continuation = (async () => {
    await cleanup.promise;
    return isPickedMediaDraftSettlementCurrent({
      mounted: true,
      formOpen,
      currentSession,
      operationSession: 4,
      currentDraft,
      operationDraft: pendingDraft,
    });
  })();

  formOpen = false;
  currentSession += 1;
  currentDraft = createPickedMediaDraft();
  formOpen = true;
  currentSession += 1;
  cleanup.resolve();

  assert.equal(await continuation, false);
  assert.equal(
    isPickedMediaDraftSettlementCurrent({
      mounted: true,
      formOpen: true,
      currentSession: 8,
      operationSession: 8,
      currentDraft,
      operationDraft: currentDraft,
    }),
    true,
  );
});

function fakeFileSystem(
  discard: (uri: string) => Promise<
    | { ok: true }
    | {
        ok: false;
        reason: "invalid-target" | "delete-failed" | "reset-in-progress";
      }
  >,
  resolveOwnedDocumentUri: (uri: string) => string = (uri) => uri,
): AppFileSystem {
  const intent = Object.freeze({}) as ReturnType<AppFileSystem["captureIntent"]>;
  return {
    platform: "ios",
    captureIntent: () => intent,
    isIntentCurrent: () => true,
    getDocumentDirectoryForArtifactPlanning: () => null,
    inspect: async () => "unknown",
    listOwnedFiles: async () => ({ status: "complete", fileCount: 0 }),
    resolveOwnedDocumentUri,
    runProtectedPicker: async (_intent, pick) => ({
      status: "complete",
      value: await pick(),
    }),
    persistPickedMedia: async () => ({
      ok: false,
      reason: "durable-storage-unavailable",
    }),
    discardPickedMedia: async (_intent, uri) => discard(uri),
    runProtectedShare: async () => ({ status: "revoked" }),
    localDataResetParticipant: {
      prepare: async () => {},
      commit: async () => {},
    },
  } as AppFileSystem;
}

test("record draft keeps its committed original while superseded staged files remain retryable", () => {
  const original = "file:///documents/woofwatcher-attachments/original.jpg";
  const first = "file:///documents/woofwatcher-attachments/first.jpg";
  const second = "file:///documents/woofwatcher-attachments/second.jpg";

  const opened = createPickedMediaDraft(original);
  const stagedFirst = stagePickedMediaDraft(opened, first);
  const stagedSecond = stagePickedMediaDraft(stagedFirst.draft, second);

  assert.deepEqual(stagedSecond.supersededUris, [first]);
  assert.deepEqual(stagedSecond.draft, {
    originalUri: original,
    selectedUri: second,
    stagedUris: [first, second],
  });

  const afterFailedCleanup = settlePickedMediaDraftRelease(
    stagedSecond.draft,
    [],
  );
  assert.deepEqual(afterFailedCleanup.stagedUris, [first, second]);
  assert.deepEqual(cancelPickedMediaDraft(afterFailedCleanup).releaseUris, [
    first,
    second,
  ]);
  assert.equal(
    cancelPickedMediaDraft(afterFailedCleanup).releaseUris.includes(original),
    false,
  );
});

test("accepted record draft commit retains the selection and releases the old original plus superseded staging", () => {
  const original = "file:///documents/woofwatcher-attachments/original.jpg";
  const first = "file:///documents/woofwatcher-attachments/first.jpg";
  const second = "file:///documents/woofwatcher-attachments/second.jpg";
  let draft = stagePickedMediaDraft(
    stagePickedMediaDraft(createPickedMediaDraft(original), first).draft,
    second,
  ).draft;
  draft = settlePickedMediaDraftRelease(draft, [first]);

  assert.deepEqual(draft.stagedUris, [second]);
  assert.deepEqual(commitPickedMediaDraft(draft), {
    retainedUri: second,
    releaseUris: [original],
  });
});

test("rejected save can leave the draft untouched so the original and staged selection remain available", () => {
  const original = "file:///documents/woofwatcher-attachments/original.jpg";
  const selected = "file:///documents/woofwatcher-attachments/selected.jpg";
  const draft = stagePickedMediaDraft(
    createPickedMediaDraft(original),
    selected,
  ).draft;

  assert.equal(draft.originalUri, original);
  assert.equal(draft.selectedUri, selected);
  assert.deepEqual(draft.stagedUris, [selected]);
});

test("release de-duplicates targets, protects live shared references, and reports only physical delete failures", async () => {
  const calls: string[] = [];
  const protectedUri =
    "file:///documents/woofwatcher-attachments/shared.jpg";
  const failedUri = "file:///documents/woofwatcher-attachments/locked.jpg";
  const externalUri = "https://example.test/not-owned.jpg";
  const appFileSystem = fakeFileSystem(async (uri) => {
    calls.push(uri);
    if (uri === failedUri) return { ok: false, reason: "delete-failed" };
    if (uri === externalUri) return { ok: false, reason: "invalid-target" };
    return { ok: true };
  });

  const result = await releasePickedMediaReferences({
    appFileSystem,
    uris: [protectedUri, failedUri, failedUri, externalUri, ""],
    protectedUris: [protectedUri],
  });

  assert.deepEqual(calls, [failedUri, externalUri]);
  assert.deepEqual(result, {
    status: "partial-failure",
    releasedUris: [],
    skippedUris: [protectedUri, externalUri],
    failedUris: [failedUri],
  });
});

test("release protects a live file when an old iOS container URI aliases its current document URI", async () => {
  const oldUri =
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/woofwatcher-attachments/shared.jpg";
  const currentUri =
    "file:///var/mobile/Containers/Data/Application/NEW/Documents/woofwatcher-attachments/shared.jpg";
  const calls: string[] = [];
  const appFileSystem = fakeFileSystem(
    async (uri) => {
      calls.push(uri);
      return { ok: true };
    },
    (uri) => (uri === oldUri ? currentUri : uri),
  );

  const result = await releasePickedMediaReferences({
    appFileSystem,
    uris: [oldUri],
    protectedUris: [currentUri],
  });

  assert.deepEqual(calls, []);
  assert.deepEqual(result, {
    status: "complete",
    releasedUris: [],
    skippedUris: [oldUri],
    failedUris: [],
  });
});

test("release stops on reset revocation so a stale caller cannot apply a metadata cleanup plan", async () => {
  const first = "file:///documents/woofwatcher-attachments/first.jpg";
  const second = "file:///documents/woofwatcher-attachments/second.jpg";
  const calls: string[] = [];
  const appFileSystem = fakeFileSystem(async (uri) => {
    calls.push(uri);
    return { ok: false, reason: "reset-in-progress" };
  });

  assert.deepEqual(
    await releasePickedMediaReferences({
      appFileSystem,
      uris: [first, second],
    }),
    { status: "revoked" },
  );
  assert.deepEqual(calls, [first]);
});

test("release converts an adapter cleanup rejection into a truthful partial failure", async () => {
  const failedUri =
    "file:///documents/woofwatcher-attachments/inspection-failed.jpg";
  const appFileSystem = fakeFileSystem(async () => {
    throw new Error("getInfoAsync denied");
  });

  assert.deepEqual(
    await releasePickedMediaReferences({
      appFileSystem,
      uris: [failedUri],
    }),
    {
      status: "partial-failure",
      releasedUris: [],
      skippedUris: [],
      failedUris: [failedUri],
    },
  );
});

test("QA clear removes successful and shared metadata but retains every evidence row whose physical cleanup failed", async () => {
  const sharedUri = "file:///documents/woofwatcher-attachments/shared.png";
  const failedUri = "file:///documents/woofwatcher-attachments/locked.png";
  const evidence = [
    { uri: sharedUri, fileName: "shared.png", capturedAtIso: "2026-08-20T01:00:00.000Z" },
    { uri: failedUri, fileName: "locked-a.png", capturedAtIso: "2026-08-20T02:00:00.000Z" },
    { uri: failedUri, fileName: "locked-b.png", capturedAtIso: "2026-08-20T03:00:00.000Z" },
  ];
  const calls: string[] = [];
  const appFileSystem = fakeFileSystem(async (uri) => {
    calls.push(uri);
    return uri === failedUri
      ? { ok: false, reason: "delete-failed" }
      : { ok: true };
  });

  const result = await clearPickedMediaEvidence({
    appFileSystem,
    evidence,
    protectedUris: [sharedUri],
  });

  assert.deepEqual(calls, [failedUri]);
  assert.deepEqual(result, {
    status: "partial-failure",
    remainingEvidence: [evidence[1], evidence[2]],
    clearedCount: 1,
    failedCount: 2,
  });
});

test("QA clear retains every old/current URI alias when their shared physical delete fails", async () => {
  const oldUri =
    "file:///var/mobile/Containers/Data/Application/OLD/Documents/woofwatcher-attachments/shared.png";
  const currentUri =
    "file:///var/mobile/Containers/Data/Application/NEW/Documents/woofwatcher-attachments/shared.png";
  const evidence = [
    { uri: oldUri, fileName: "old-alias.png" },
    { uri: currentUri, fileName: "current-alias.png" },
  ];
  const calls: string[] = [];
  const appFileSystem = fakeFileSystem(
    async (uri) => {
      calls.push(uri);
      return { ok: false, reason: "delete-failed" };
    },
    (uri) => (uri === oldUri ? currentUri : uri),
  );

  const result = await clearPickedMediaEvidence({
    appFileSystem,
    evidence,
  });

  assert.deepEqual(calls, [oldUri]);
  assert.deepEqual(result, {
    status: "partial-failure",
    remainingEvidence: evidence,
    clearedCount: 0,
    failedCount: 2,
  });
});

test("QA clear returns no metadata plan when reset revokes file cleanup", async () => {
  const evidence = [
    {
      uri: "file:///documents/woofwatcher-attachments/qa.png",
      fileName: "qa.png",
    },
  ];
  const appFileSystem = fakeFileSystem(async () => ({
    ok: false,
    reason: "reset-in-progress",
  }));

  assert.deepEqual(
    await clearPickedMediaEvidence({ appFileSystem, evidence }),
    { status: "revoked" },
  );
});

test("QA evidence clear durably removes metadata before deleting the physical file", async () => {
  const uri = "file:///documents/woofwatcher-attachments/qa.png";
  const events: string[] = [];
  const appFileSystem = fakeFileSystem(async () => {
    events.push("delete:file");
    return { ok: true };
  });

  const result = await runPickedMediaEvidenceClear({
    appFileSystem,
    evidence: [{ uri, fileName: "qa.png" }],
    removeMetadata: async () => {
      events.push("persist:metadata-removed");
      return "committed";
    },
  });

  assert.deepEqual(events, ["persist:metadata-removed", "delete:file"]);
  assert.deepEqual(result, {
    status: "complete",
    clearedCount: 1,
    failedCount: 0,
  });
});

test("QA evidence clear starts no physical delete when metadata removal cannot commit", async () => {
  let deletes = 0;
  const appFileSystem = fakeFileSystem(async () => {
    deletes += 1;
    return { ok: true };
  });

  assert.deepEqual(
    await runPickedMediaEvidenceClear({
      appFileSystem,
      evidence: [
        {
          uri: "file:///documents/woofwatcher-attachments/qa.png",
          fileName: "qa.png",
        },
      ],
      removeMetadata: async () => "not-committed",
    }),
    { status: "not-cleared" },
  );
  assert.equal(deletes, 0);
});
