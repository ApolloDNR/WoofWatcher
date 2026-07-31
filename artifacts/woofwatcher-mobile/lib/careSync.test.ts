import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCareSyncOutbox,
  deriveCareSyncDashboard,
  reconcileCareDocFromServer,
  isUnsyncedEntry,
  shouldRetryCreate,
  shouldRetryUpdate,
  buildCareEntryRefreshPlan,
  mergeServerAndLocalEntries,
  withSyncedStatus,
} from "./careSync.ts";
import * as careSyncModule from "./careSync.ts";

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
  assert.equal(
    isUnsyncedEntry({ id: "server_1", syncStatus: "synced" }),
    false,
  );
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
    [
      {
        id: "temp_old",
        occurredAt: "2026-06-06T08:00:00.000Z",
        syncStatus: "local",
      },
    ],
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

test("keeps care-entry refresh full until the API has a real update cursor", () => {
  const plan = buildCareEntryRefreshPlan({
    hasUpdatedAtCursor: false,
    hasDeleteTombstones: false,
  });

  assert.deepEqual(plan, {
    mode: "full",
    params: undefined,
    boundary:
      "Full care-entry refresh required until the API exposes an updatedAt cursor and delete tombstones.",
  });
});

test("separates create retries from update retries", () => {
  assert.equal(shouldRetryCreate({ id: "temp_1", syncStatus: "failed" }), true);
  assert.equal(shouldRetryCreate({ id: "local_1", syncStatus: "local" }), true);
  assert.equal(
    shouldRetryCreate({ id: "server_1", syncStatus: "failed" }),
    false,
  );
  assert.equal(
    shouldRetryCreate({ id: "server_1", syncStatus: "local" }),
    false,
  );

  assert.equal(
    shouldRetryUpdate({ id: "server_1", syncStatus: "failed" }),
    true,
  );
  assert.equal(
    shouldRetryUpdate({ id: "server_1", syncStatus: "local" }),
    true,
  );
  assert.equal(
    shouldRetryUpdate({ id: "temp_1", syncStatus: "failed" }),
    false,
  );
  assert.equal(
    shouldRetryUpdate({ id: "server_2", syncStatus: "synced" }),
    false,
  );
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
  assert.equal(
    outbox.message,
    "3 care changes need retry. 1 is still syncing.",
  );
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

test("derives a household sync dashboard for healthy synced care", () => {
  const outbox = deriveCareSyncOutbox([
    {
      id: "server_synced",
      title: "Synced walk",
      occurredAt: "2026-06-06T08:00:00.000Z",
      syncStatus: "synced",
    },
  ]);
  const dashboard = deriveCareSyncDashboard({
    outbox,
    isLoaded: true,
    isSyncing: false,
    lastUpdatedAt: "2026-06-06T08:30:00.000Z",
    householdMemberCount: 3,
    totalEntries: 12,
  });

  assert.equal(dashboard.status, "healthy");
  assert.equal(dashboard.title, "Household sync is current");
  assert.equal(dashboard.actionLabel, "Refresh");
  assert.equal(dashboard.metrics[0].label, "Care log");
  assert.equal(dashboard.metrics[0].value, "12 entries");
  assert.equal(dashboard.metrics[1].value, "3 members");
  assert.equal(dashboard.metrics[2].value, "0 waiting");
  assert.equal(dashboard.nextStep, "Last care update: Jun 6, 8:30 AM.");
});

test("derives a household sync dashboard with retry guidance", () => {
  const outbox = deriveCareSyncOutbox([
    {
      id: "temp_create",
      title: "Breakfast",
      occurredAt: "2026-06-06T12:00:00.000Z",
      syncStatus: "failed",
    },
    {
      id: "server_update",
      title: "Medication note",
      occurredAt: "2026-06-06T10:00:00.000Z",
      syncStatus: "failed",
    },
  ]);
  const dashboard = deriveCareSyncDashboard({
    outbox,
    isLoaded: true,
    isSyncing: false,
    householdMemberCount: 2,
    totalEntries: 6,
  });

  assert.equal(dashboard.status, "attention");
  assert.equal(dashboard.title, "Sync needs attention");
  assert.equal(dashboard.actionLabel, "Retry sync");
  assert.equal(dashboard.metrics[2].value, "2 waiting");
  assert.equal(
    dashboard.nextStep,
    "Retry sync so every caregiver sees the latest care.",
  );
});

test("keeps a newer local care document when a stale server refresh arrives", () => {
  const plan = reconcileCareDocFromServer({
    localDoc: {
      updatedAt: "2026-06-11T09:00:00.000Z",
      profile: { name: "Phoenix" },
    },
    localVersion: 4,
    serverDoc: {
      updatedAt: "2026-06-11T08:00:00.000Z",
      profile: { name: "Old Phoenix" },
    },
    serverVersion: 5,
    serverUpdatedAt: "2026-06-11T08:00:00.000Z",
  });

  assert.equal(plan.status, "keep-local-newer");
  assert.equal(plan.shouldPushLocal, true);
  assert.equal(plan.version, 5);
  assert.deepEqual(plan.doc, {
    updatedAt: "2026-06-11T09:00:00.000Z",
    profile: { name: "Phoenix" },
  });
  assert.equal(
    plan.message,
    "Keeping newer offline care changes and sending them back to the household.",
  );
});

test("accepts server care document when it is newer than local cache", () => {
  const plan = reconcileCareDocFromServer({
    localDoc: {
      updatedAt: "2026-06-11T08:00:00.000Z",
      profile: { name: "Old Phoenix" },
    },
    localVersion: 4,
    serverDoc: {
      updatedAt: "2026-06-11T09:00:00.000Z",
      profile: { name: "Phoenix" },
    },
    serverVersion: 5,
    serverUpdatedAt: "2026-06-11T09:00:00.000Z",
  });

  assert.equal(plan.status, "accept-server");
  assert.equal(plan.shouldPushLocal, false);
  assert.equal(plan.version, 5);
  assert.deepEqual(plan.doc, {
    updatedAt: "2026-06-11T09:00:00.000Z",
    profile: { name: "Phoenix" },
  });
});

test("seeds an empty server care document from the local cache", () => {
  const plan = reconcileCareDocFromServer({
    localDoc: {
      updatedAt: "2026-06-11T09:00:00.000Z",
      profile: { name: "Phoenix" },
    },
    localVersion: 0,
    serverDoc: {},
    serverVersion: 0,
  });

  assert.equal(plan.status, "seed-server");
  assert.equal(plan.shouldPushLocal, true);
  assert.equal(plan.version, 0);
  assert.deepEqual(plan.doc, {
    updatedAt: "2026-06-11T09:00:00.000Z",
    profile: { name: "Phoenix" },
  });
});

test("merge supersedes a temp entry once its server row arrives via clientKey", () => {
  const local = [
    {
      id: "temp_123_abc",
      title: "Breakfast",
      occurredAt: "2026-07-18T07:00:00.000Z",
      syncStatus: "failed" as const,
    },
    {
      id: "temp_456_def",
      title: "Walk",
      occurredAt: "2026-07-18T08:00:00.000Z",
      syncStatus: "failed" as const,
    },
  ];
  const server = [
    {
      id: "srv_1",
      title: "Breakfast",
      occurredAt: "2026-07-18T07:00:00.000Z",
      details: { clientKey: "temp_123_abc" },
    },
  ];

  const merged = mergeServerAndLocalEntries(local, server);

  // The meal's server row carries the temp entry's clientKey, so the temp
  // duplicate is superseded; the walk (never acknowledged) is kept for retry.
  assert.deepEqual(merged.map((entry) => entry.id).sort(), [
    "srv_1",
    "temp_456_def",
  ]);
});

test("care-entry sync strips device-only GPS route fields without mutating local care", () => {
  const sanitize = (
    careSyncModule as unknown as {
      sanitizeCareEntryDetailsForSync?: (
        details: Record<string, unknown> | null | undefined,
      ) => Record<string, unknown>;
    }
  ).sanitizeCareEntryDetailsForSync;
  assert.equal(typeof sanitize, "function");

  const localDetails = {
    route: [
      { lat: 37.8, lon: -122.1, t: 1 },
      { lat: 37.81, lon: -122.09, t: 2 },
    ],
    routeDistanceM: 940,
    routeName: "Creek loop",
    walkLifecycle: "completed",
  };

  assert.deepEqual(sanitize!(localDetails), {
    routeName: "Creek loop",
    walkLifecycle: "completed",
  });
  assert.equal(localDetails.route.length, 2);
  assert.equal(localDetails.routeDistanceM, 940);
});

test("server refresh preserves a synced entry's device-only route visualization", () => {
  const route = [
    { lat: 37.8, lon: -122.1, t: 1 },
    { lat: 37.81, lon: -122.09, t: 2 },
  ];
  const [merged] = mergeServerAndLocalEntries(
    [
      {
        id: "server_walk",
        occurredAt: "2026-07-30T18:00:00.000Z",
        syncStatus: "synced",
        details: { route, routeDistanceM: 940, localDraft: "not synced" },
      },
    ],
    [
      {
        id: "server_walk",
        occurredAt: "2026-07-30T18:00:00.000Z",
        details: { routeName: "Creek loop" },
      },
    ],
  );

  assert.deepEqual(merged.details, {
    routeName: "Creek loop",
    route,
    routeDistanceM: 940,
  });
});

test("server acknowledgement carries a temp walk's device-only route to the real id", () => {
  const route = [
    { lat: 37.8, lon: -122.1, t: 1 },
    { lat: 37.81, lon: -122.09, t: 2 },
  ];
  const [merged] = mergeServerAndLocalEntries(
    [
      {
        id: "temp_walk",
        occurredAt: "2026-07-30T18:00:00.000Z",
        syncStatus: "failed",
        details: { route, routeDistanceM: 940 },
      },
    ],
    [
      {
        id: "server_walk",
        occurredAt: "2026-07-30T18:00:00.000Z",
        details: { clientKey: "temp_walk", routeName: "Creek loop" },
      },
    ],
  );

  assert.equal(merged.id, "server_walk");
  assert.deepEqual(merged.details, {
    clientKey: "temp_walk",
    routeName: "Creek loop",
    route,
    routeDistanceM: 940,
  });
});
