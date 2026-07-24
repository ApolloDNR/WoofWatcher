import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createQuickLogFailureAnnouncementGuard,
  createQuickLogUndoGuard,
  deriveQuickLogFailure,
  quickLogFeedbackPersistenceCopy,
  resolveQuickLogEntry,
  runQuickLogUndo,
} from "./quickLogRuntime.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

test("resolves a temp quick-log identity to its current server entry", () => {
  const serverEntry = {
    id: "server_1",
    type: "meal",
    occurredAt: "2026-07-24T12:00:00.000Z",
    caregiver: "Apollo",
    details: { clientKey: "temp_meal_1" },
  };
  const resolved = resolveQuickLogEntry([serverEntry], {
    id: "temp_meal_1",
    type: "meal",
    occurredAt: serverEntry.occurredAt,
    caregiver: "Apollo",
  });

  assert.equal(resolved?.id, "server_1");
});

test("keeps persistence failures authoritative and never calls an uncertain write saved", () => {
  const storageFailure = deriveQuickLogFailure({
    storageWarning: "save-failed",
    refreshError: null,
    syncRefreshError: null,
    feedbackEntry: null,
    transientFailure: null,
  });
  assert.deepEqual(storageFailure, {
    message:
      "This care log may not be saved on this device. Review device storage and try again.",
    persistence: "uncertain",
  });
  assert.doesNotMatch(
    quickLogFeedbackPersistenceCopy(storageFailure),
    /Saved locally/i,
  );

  const cleanupFailure = deriveQuickLogFailure({
    storageWarning: null,
    refreshError:
      "A deleted care log is hidden on this device but still needs cloud cleanup. Refresh to retry.",
    syncRefreshError: null,
    feedbackEntry: null,
    transientFailure: null,
  });
  assert.equal(cleanupFailure?.persistence, "local-only");
  assert.match(cleanupFailure?.message ?? "", /still needs cloud cleanup/);
});

test("failure announcements fire once per visible failure and recur after recovery", () => {
  const guard = createQuickLogFailureAnnouncementGuard();

  assert.equal(guard.next(null), null);
  assert.equal(guard.next("Meal was not saved."), "Meal was not saved.");
  assert.equal(guard.next("Meal was not saved."), null);
  assert.equal(
    guard.next("Cloud sync needs attention."),
    "Cloud sync needs attention.",
  );
  assert.equal(guard.next(null), null);
  assert.equal(guard.next("Meal was not saved."), "Meal was not saved.");
});

test("a stale undo completion cannot clear newer quick-log feedback", async () => {
  const guard = createQuickLogUndoGuard();
  const deletion = deferred<boolean>();
  let currentFeedbackId: string | null = "temp_a";
  const busy: boolean[] = [];
  let removed = 0;
  const failures: string[] = [];

  const firstUndo = runQuickLogUndo({
    guard,
    feedbackId: "temp_a",
    entryId: "server_a",
    getCurrentFeedbackId: () => currentFeedbackId,
    deleteEntry: async (id) => {
      assert.equal(id, "server_a");
      return deletion.promise;
    },
    onBusyChange: (value) => busy.push(value),
    onRemoved: () => {
      removed += 1;
    },
    onFailure: (message) => failures.push(message),
    failureMessage: "Meal could not be undone.",
  });
  assert.equal(guard.busy, true);

  currentFeedbackId = "temp_b";
  deletion.resolve(true);
  assert.equal(await firstUndo, false);
  assert.equal(removed, 0);
  assert.deepEqual(failures, []);
  assert.deepEqual(busy, [true, false]);
  assert.equal(guard.busy, false);
});

test("the undo guard rejects a same-tick second undo and reports matching failures", async () => {
  const guard = createQuickLogUndoGuard();
  const deletion = deferred<boolean>();
  const failures: string[] = [];
  let calls = 0;
  const options = {
    guard,
    feedbackId: "temp_a",
    entryId: "temp_a",
    getCurrentFeedbackId: () => "temp_a",
    deleteEntry: async () => {
      calls += 1;
      return deletion.promise;
    },
    onBusyChange: () => undefined,
    onRemoved: () => undefined,
    onFailure: (message: string) => failures.push(message),
    failureMessage: "Meal could not be undone.",
  };

  const first = runQuickLogUndo(options);
  const second = runQuickLogUndo(options);
  assert.equal(await second, false);
  assert.equal(calls, 1);

  deletion.resolve(false);
  assert.equal(await first, false);
  assert.deepEqual(failures, ["Meal could not be undone."]);
});
