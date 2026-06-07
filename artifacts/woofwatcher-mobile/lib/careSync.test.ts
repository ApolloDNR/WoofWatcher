import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isUnsyncedEntry,
  shouldRetryCreate,
  shouldRetryUpdate,
  mergeServerAndLocalEntries,
  withSyncedStatus,
} from "./careSync.ts";

test("marks server entries as synced", () => {
  const [entry] = withSyncedStatus([
    { id: "server_1", occurredAt: "2026-06-06T10:00:00.000Z" },
  ]);

  assert.equal(entry.syncStatus, "synced");
});

test("recognizes local, pending, failed, and temp entries as unsynced", () => {
  assert.equal(isUnsyncedEntry({ id: "temp_1", syncStatus: "pending" }), true);
  assert.equal(isUnsyncedEntry({ id: "local_1", syncStatus: "local" }), true);
  assert.equal(isUnsyncedEntry({ id: "failed_1", syncStatus: "failed" }), true);
  assert.equal(isUnsyncedEntry({ id: "server_1", syncStatus: "synced" }), false);
});

test("keeps unsynced local entries when server rows refresh", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "temp_1",
        occurredAt: "2026-06-06T12:00:00.000Z",
        syncStatus: "failed",
      },
      {
        id: "server_stale",
        occurredAt: "2026-06-06T09:00:00.000Z",
        syncStatus: "synced",
      },
    ],
    [
      {
        id: "server_new",
        occurredAt: "2026-06-06T11:00:00.000Z",
      },
    ],
  );

  assert.deepEqual(
    merged.map((entry) => [entry.id, entry.syncStatus]),
    [
      ["temp_1", "failed"],
      ["server_new", "synced"],
    ],
  );
});

test("sorts merged entries newest first", () => {
  const merged = mergeServerAndLocalEntries(
    [{ id: "temp_old", occurredAt: "2026-06-06T08:00:00.000Z", syncStatus: "local" }],
    [{ id: "server_new", occurredAt: "2026-06-06T12:00:00.000Z" }],
  );

  assert.deepEqual(
    merged.map((entry) => entry.id),
    ["server_new", "temp_old"],
  );
});

test("keeps failed server edits without duplicating the matching server row", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server_1",
        occurredAt: "2026-06-06T12:00:00.000Z",
        syncStatus: "failed",
        syncError: "Saved locally. Refresh to retry sync.",
      },
    ],
    [
      {
        id: "server_1",
        occurredAt: "2026-06-06T10:00:00.000Z",
      },
      {
        id: "server_2",
        occurredAt: "2026-06-06T11:00:00.000Z",
      },
    ],
  );

  assert.deepEqual(
    merged.map((entry) => [entry.id, entry.syncStatus]),
    [
      ["server_1", "failed"],
      ["server_2", "synced"],
    ],
  );
});

test("separates create retries from update retries", () => {
  assert.equal(shouldRetryCreate({ id: "temp_1", syncStatus: "failed" }), true);
  assert.equal(shouldRetryCreate({ id: "local_1", syncStatus: "local" }), true);
  assert.equal(shouldRetryCreate({ id: "server_1", syncStatus: "failed" }), false);
  assert.equal(shouldRetryCreate({ id: "server_1", syncStatus: "local" }), false);

  assert.equal(shouldRetryUpdate({ id: "server_1", syncStatus: "failed" }), true);
  assert.equal(shouldRetryUpdate({ id: "server_1", syncStatus: "local" }), true);
  assert.equal(shouldRetryUpdate({ id: "temp_1", syncStatus: "failed" }), false);
  assert.equal(shouldRetryUpdate({ id: "server_2", syncStatus: "synced" }), false);
});
