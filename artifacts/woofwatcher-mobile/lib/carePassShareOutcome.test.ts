import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSavedCarePassShareAnnouncement,
  createSavedCarePassShareSession,
  runSavedCarePassShare,
} from "./carePassShareOutcome.ts";

test("describes every saved Care Pass share outcome without inventing delivery", () => {
  const expected = {
    shared: "Care Pass saved to Report History and shared.",
    copied:
      "Care Pass saved to Report History and copied to the clipboard. Treat the clipboard as private care data.",
    downloaded:
      "Care Pass saved to Report History and its download started. Store the file only in a trusted location.",
    dismissed:
      "Care Pass saved to Report History. The share sheet closed without sharing.",
    unconfirmed:
      "Care Pass saved to Report History. Android cannot confirm whether it was sent or saved.",
    "not-completed":
      "Care Pass saved to Report History. Sharing was not completed; the sheet may have closed, or no share target was available.",
    failed:
      "Care Pass saved to Report History, but sharing could not be confirmed. You can retry from Report History.",
  } as const;

  for (const [outcome, message] of Object.entries(expected)) {
    assert.equal(
      buildSavedCarePassShareAnnouncement(outcome as keyof typeof expected),
      message,
    );
  }
});

test("keeps one Care Pass save/share flow in flight and reuses the saved report on retry", async () => {
  const session = createSavedCarePassShareSession();
  let saveCalls = 0;
  let shareCalls = 0;
  const messages: string[] = [];
  let finishShare: ((outcome: "dismissed") => void) | null = null;
  const firstShare = new Promise<"dismissed">((resolve) => {
    finishShare = resolve;
  });
  const dependencies = {
    save: () => {
      saveCalls += 1;
      return true;
    },
    share: () => {
      shareCalls += 1;
      return shareCalls === 1 ? firstShare : Promise.resolve("shared" as const);
    },
    present: (message: string) => messages.push(message),
  };

  const firstRun = runSavedCarePassShare(session, dependencies);
  const duplicateRun = await runSavedCarePassShare(session, dependencies);

  assert.deepEqual(duplicateRun, { status: "in-flight" });
  assert.equal(saveCalls, 1);
  assert.equal(shareCalls, 1);

  finishShare?.("dismissed");
  assert.deepEqual(await firstRun, {
    status: "completed",
    outcome: "dismissed",
    message:
      "Care Pass saved to Report History. The share sheet closed without sharing.",
  });
  assert.equal(messages.length, 1);

  const retryRun = await runSavedCarePassShare(session, dependencies);
  assert.equal(retryRun.status, "completed");
  assert.equal(saveCalls, 1, "retry must reuse the already-saved Care Pass");
  assert.equal(shareCalls, 2);
  assert.equal(messages.length, 2);
});
