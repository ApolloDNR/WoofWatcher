import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCareSyncOutbox,
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

test("derives a durable outbox from unsynced care entries", () => {
  const outbox = deriveCareSyncOutbox([
    {
      id: "server_synced",
      title: "Synced walk",
      occurredAt: "2026-06-06T08:00:00.000Z",
      syncStatus: "synced",
    },
    {
      id: "temp_create",
      title: "Breakfast",
      occurredAt: "2026-06-06T12:00:00.000Z",
      syncStatus: "failed",
      syncError: "Network failed",
    },
    {
      id: "local_create",
      title: "Water refill",
      occurredAt: "2026-06-06T11:00:00.000Z",
      syncStatus: "local",
    },
    {
      id: "server_update",
      title: "Medication note",
      occurredAt: "2026-06-06T10:00:00.000Z",
      syncStatus: "failed",
    },
    {
      id: "temp_pending",
      title: "Potty",
      occurredAt: "2026-06-06T09:00:00.000Z",
      syncStatus: "pending",
    },
  ]);

  assert.equal(outbox.status, "needs-retry");
  assert.equal(outbox.total, 4);
  assert.equal(outbox.pending, 1);
  assert.equal(outbox.failed, 2);
  assert.equal(outbox.local, 1);
  assert.deepEqual(outbox.retryableCreateIds, ["temp_create", "local_create"]);
  assert.deepEqual(outbox.retryableUpdateIds, ["server_update"]);
  assert.deepEqual(
    outbox.items.map((item) => [item.id, item.operation, item.retryable]),
    [
      ["temp_create", "create", true],
      ["local_create", "create", true],
      ["server_update", "update", true],
      ["temp_pending", "create", false],
    ],
  );
  assert.equal(outbox.message, "3 care changes need retry. 1 is still syncing.");
  assert.equal(outbox.actionLabel, "Retry sync");
});

test("derives an idle outbox when all entries are synced", () => {
  const outbox = deriveCareSyncOutbox([
    {
      id: "server_synced",
      title: "Synced walk",
      occurredAt: "2026-06-06T08:00:00.000Z",
      syncStatus: "synced",
    },
  ]);

  assert.equal(outbox.status, "idle");
  assert.equal(outbox.total, 0);
  assert.deepEqual(outbox.items, []);
  assert.equal(outbox.message, "All care changes are synced.");
  assert.equal(outbox.actionLabel, "Synced");
});
