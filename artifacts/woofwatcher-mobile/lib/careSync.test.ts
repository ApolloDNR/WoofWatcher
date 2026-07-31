import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addDiscardedServerEntryId,
  adoptServerEntry,
  applyQueuedPatchToAcknowledgedEntry,
  CARE_ENTRY_PENDING_DELETE,
  CareEntryConflictRetryError,
  CareSyncMutationTimeoutError,
  cleanupDiscardedServerEntryRows,
  createSerializedCareSyncWriter,
  createSerializedCareEntryMutationQueue,
  decideCareEntryEditSyncDisposition,
  deriveCareSyncOutbox,
  deriveCareSyncDashboard,
  diffCareEntryPendingDetails,
  filterDiscardedServerEntries,
  findCreatedCareEntryLocalSnapshot,
  reconcileCareDocFromServer,
  isUnsyncedEntry,
  migrateAcknowledgedTempEntryForRetry,
  mergeCareEntryPendingSyncPatch,
  prepareCareEntryForOfflineEdit,
  rebaseCareEntryAfterConflict,
  recoverInterruptedCareEntryMutations,
  shouldRetryCreate,
  shouldRetryUpdate,
  buildCareEntryRefreshPlan,
  mergeServerAndLocalEntries,
  normalizeDiscardedServerEntryIds,
  reconcileCreatedCareEntryAcknowledgement,
  removeDiscardedServerEntryId,
  restoreEntryAfterDeleteFailure,
  retryCareEntryMutationAfterConflict,
  requiresCareEntrySyncReview,
  sanitizeCareEntryDetailsForSync,
  selectWoofWatcherKeysForOwnerWipe,
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
    shouldRetryUpdate({
      id: "server_1",
      syncStatus: "failed",
      pendingSyncPatch: { note: "Retry me" },
    }),
    true,
  );
  assert.equal(
    shouldRetryUpdate({
      id: "server_1",
      syncStatus: "local",
      pendingSyncPatch: { mood: "great" },
    }),
    true,
  );
  assert.equal(
    shouldRetryUpdate({ id: "server_legacy", syncStatus: "failed" }),
    false,
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
      pendingSyncPatch: { note: "Given with food" },
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

test("merge migrates only the first duplicate server row for one temp client key", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "temp_walk",
        title: "Newest local walk",
        occurredAt: "2026-07-18T08:00:00.000Z",
        syncStatus: "failed" as const,
      },
    ],
    [
      {
        id: "server_first",
        title: "First server copy",
        occurredAt: "2026-07-18T08:00:00.000Z",
        details: { clientKey: "temp_walk" },
      },
      {
        id: "server_duplicate",
        title: "Duplicate server copy",
        occurredAt: "2026-07-18T07:59:00.000Z",
        details: { clientKey: "temp_walk" },
      },
    ],
  );

  assert.deepEqual(
    merged.map((entry) => [
      entry.id,
      entry.title,
      entry.syncStatus,
    ]),
    [
      ["server_first", "Newest local walk", "failed"],
      ["server_duplicate", "Duplicate server copy", "synced"],
    ],
  );
});

test("care-entry sync strips device-only GPS route fields without mutating local care", () => {
  const localDetails = {
    route: [
      { lat: 37.8, lon: -122.1, t: 1 },
      { lat: 37.81, lon: -122.09, t: 2 },
    ],
    routeDistanceM: 940,
    routeName: "Creek loop",
    walkLifecycle: "completed",
  };

  assert.deepEqual(sanitizeCareEntryDetailsForSync(localDetails), {
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

test("create acknowledgement adopts the server id and fields while retaining the device route", () => {
  const route = [
    { lat: 37.8, lon: -122.1, t: 1 },
    { lat: 37.81, lon: -122.09, t: 2 },
  ];

  const acknowledged = adoptServerEntry(
    {
      id: "temp_walk",
      title: "Local draft",
      occurredAt: "2026-07-30T18:00:00.000Z",
      syncStatus: "failed" as const,
      syncError: "Saved locally. Refresh to retry sync.",
      details: {
        route,
        routeDistanceM: 940,
        routeName: "Local route name",
        localDraft: "must not reach the server view",
      },
    },
    {
      id: "server_walk",
      title: "Evening walk",
      occurredAt: "2026-07-30T18:01:00.000Z",
      details: {
        clientKey: "temp_walk",
        routeName: "Creek loop",
      },
    },
  );

  assert.deepEqual(acknowledged, {
    id: "server_walk",
    title: "Evening walk",
    occurredAt: "2026-07-30T18:01:00.000Z",
    syncStatus: "synced",
    syncError: undefined,
    details: {
      clientKey: "temp_walk",
      routeName: "Creek loop",
      route,
      routeDistanceM: 940,
    },
  });
});

test("conflict rebase preserves only pending local fields over the newest server row", () => {
  const pendingPatch = mergeCareEntryPendingSyncPatch(
    { note: "Local note" },
    { severity: "watch" },
  );
  const rebased = rebaseCareEntryAfterConflict(
    {
      id: "server_1",
      note: "Local note",
      mood: "okay",
      caregiver: "Apollo",
      details: {
        clientSyncRevision: 3,
        route: [{ latitude: 33.4, longitude: -112.1 }],
      },
      syncStatus: "failed" as const,
      pendingSyncPatch: pendingPatch,
    },
    {
      id: "server_1",
      note: "Newer household note",
      mood: "great",
      caregiver: "Melissa",
      details: {
        clientSyncRevision: 20,
        routeName: "Creek loop",
      },
      syncStatus: "synced" as const,
    },
    pendingPatch,
  );

  assert.equal(rebased.note, "Local note");
  assert.equal(rebased.severity, "watch");
  assert.equal(rebased.mood, "great");
  assert.equal(rebased.caregiver, "Melissa");
  assert.deepEqual(rebased.details, {
    clientSyncRevision: 20,
    routeName: "Creek loop",
    route: [{ latitude: 33.4, longitude: -112.1 }],
  });
  assert.equal(rebased.syncStatus, "pending");
  assert.equal(rebased.syncError, undefined);
});

test("conflict rebase preserves newer server detail keys beside local detail edits", () => {
  const rebased = rebaseCareEntryAfterConflict(
    {
      id: "server_1",
      details: { clientSyncRevision: 3, localField: "edited" },
    },
    {
      id: "server_1",
      details: { clientSyncRevision: 20, serverField: "newer" },
    },
    {
      details: { localField: "edited" },
    },
  );

  assert.deepEqual(rebased.details, {
    clientSyncRevision: 20,
    serverField: "newer",
    localField: "edited",
  });
});

test("detail journaling records only owner changes and merges repeated edits", () => {
  const detailPatch = diffCareEntryPendingDetails(
    {
      clientSyncRevision: 7,
      routeName: "Creek loop",
      socialOutcome: "Calm hello",
    },
    {
      clientSyncRevision: 8,
      routeName: "Creek loop",
      socialOutcome: "Played gently",
      noteContext: "Met Luna",
    },
  );

  assert.deepEqual(detailPatch, {
    socialOutcome: "Played gently",
    noteContext: "Met Luna",
  });
  assert.deepEqual(
    mergeCareEntryPendingSyncPatch(
      { details: { routeName: "Local route" } },
      { details: detailPatch },
    ),
    {
      details: {
        routeName: "Local route",
        socialOutcome: "Played gently",
        noteContext: "Met Luna",
      },
    },
  );
});

test("signed-out edits retain and extend the durable conflict-rebase journal", () => {
  type OfflineEntry = {
    id: string;
    note?: string;
    mood?: string;
    caregiver?: string;
    details?: Record<string, unknown>;
    syncStatus?: "local" | "pending" | "synced" | "failed";
    syncError?: string;
    pendingSyncPatch?: {
      note?: string;
      mood?: string;
    };
  };
  const current: OfflineEntry = {
    id: "server_1",
    note: "Older local note",
    mood: "okay",
    caregiver: "Apollo",
    details: { clientSyncRevision: 7 },
    syncStatus: "failed",
    pendingSyncPatch: { note: "Older local note" },
  };
  const newPatch = { mood: "great" };
  const pendingSyncPatch = mergeCareEntryPendingSyncPatch(
    current.pendingSyncPatch,
    newPatch,
  );
  const offline = prepareCareEntryForOfflineEdit(
    current,
    newPatch,
    pendingSyncPatch,
  );

  assert.equal(offline.syncStatus, "local");
  assert.deepEqual(offline.pendingSyncPatch, {
    note: "Older local note",
    mood: "great",
  });

  const rebased = rebaseCareEntryAfterConflict(
    offline,
    {
      id: "server_1",
      note: "Newer household note",
      mood: "tired",
      caregiver: "Melissa",
      details: { clientSyncRevision: 20 },
      syncStatus: "synced",
    },
    offline.pendingSyncPatch ?? {},
  );

  assert.equal(rebased.note, "Older local note");
  assert.equal(rebased.mood, "great");
  assert.equal(rebased.caregiver, "Melissa");
  assert.equal(rebased.details?.clientSyncRevision, 20);
});

test("the first signed-out edit creates a durable conflict-rebase journal", () => {
  const firstPatch = { note: "First offline correction" };
  const pendingSyncPatch = mergeCareEntryPendingSyncPatch(
    undefined,
    firstPatch,
  );
  const offline = prepareCareEntryForOfflineEdit(
    {
      id: "server_1",
      note: "Older note",
      mood: "okay",
      details: { clientSyncRevision: 7 },
      syncStatus: "synced" as const,
    },
    firstPatch,
    pendingSyncPatch,
  );

  assert.deepEqual(offline.pendingSyncPatch, firstPatch);
  const rebased = rebaseCareEntryAfterConflict(
    offline,
    {
      id: "server_1",
      note: "Newer household note",
      mood: "great",
      details: { clientSyncRevision: 20 },
      syncStatus: "synced" as const,
    },
    offline.pendingSyncPatch ?? {},
  );
  assert.equal(rebased.note, "First offline correction");
  assert.equal(rebased.mood, "great");
  assert.equal(rebased.details?.clientSyncRevision, 20);
});

test("a signed-out edit cannot create a partial journal for a legacy row", () => {
  const legacyEntry = {
    id: "server_legacy",
    note: "Older local note that predates field journaling",
    mood: "okay",
    details: { clientSyncRevision: 9 },
    syncStatus: "failed" as const,
  };

  assert.equal(
    decideCareEntryEditSyncDisposition(legacyEntry, false),
    "review-required",
  );
  assert.equal(
    decideCareEntryEditSyncDisposition(legacyEntry, true),
    "review-required",
  );
  const preserved = prepareCareEntryForOfflineEdit(
    legacyEntry,
    { mood: "great" },
  );

  assert.equal(preserved.mood, "great");
  assert.equal(preserved.note, legacyEntry.note);
  assert.equal(preserved.pendingSyncPatch, undefined);
  assert.equal(requiresCareEntrySyncReview(preserved), true);
});

test("a cleared top-level field survives JSON persistence and conflict rebase", () => {
  const pendingSyncPatch = mergeCareEntryPendingSyncPatch(
    undefined,
    { note: undefined },
  );
  assert.deepEqual(pendingSyncPatch.note, CARE_ENTRY_PENDING_DELETE);

  const persistedPatch = JSON.parse(
    JSON.stringify(pendingSyncPatch),
  ) as typeof pendingSyncPatch;
  const rebased = rebaseCareEntryAfterConflict(
    {
      id: "server_1",
      note: undefined,
      mood: "okay",
      details: { clientSyncRevision: 7 },
      syncStatus: "local" as const,
      pendingSyncPatch: persistedPatch,
    },
    {
      id: "server_1",
      note: "Newer household note",
      mood: "great",
      details: { clientSyncRevision: 20 },
      syncStatus: "synced" as const,
    },
    persistedPatch,
  );

  assert.equal(Object.hasOwn(rebased, "note"), false);
  assert.equal(rebased.note, undefined);
  assert.equal(rebased.mood, "great");
  assert.equal(rebased.details?.clientSyncRevision, 20);
});

test("pre-protocol cached updates without a field journal require review", () => {
  const legacyEntry = {
    id: "server_legacy",
    title: "Older cached edit",
    occurredAt: "2026-07-30T18:00:00.000Z",
    syncStatus: "failed" as const,
    syncError:
      "This change predates conflict-safe field journaling.",
    details: { clientSyncRevision: 9 },
  };

  assert.equal(shouldRetryUpdate(legacyEntry), false);
  assert.equal(requiresCareEntrySyncReview(legacyEntry), true);
  const outbox = deriveCareSyncOutbox([legacyEntry]);
  assert.equal(outbox.status, "needs-retry");
  assert.equal(outbox.retryable, 0);
  assert.equal(outbox.actionLabel, "View saved changes");
  assert.deepEqual(outbox.reviewRequiredIds, ["server_legacy"]);
  assert.match(outbox.message, /preserved on this device/i);
});

test("a 409 fetches the winning row and retries one rebased local patch", async () => {
  type ConflictEntry = {
    id: string;
    note?: string;
    mood?: string;
    details?: Record<string, unknown>;
    syncStatus?: "pending" | "failed" | "synced";
    pendingSyncPatch?: {
      note?: string;
    };
  };
  const input: ConflictEntry = {
    id: "server_1",
    note: "Local note",
    mood: "okay",
    details: { clientSyncRevision: 3 },
    syncStatus: "failed",
    pendingSyncPatch: { note: "Local note" },
  };
  const server: ConflictEntry = {
    id: "server_1",
    note: "Newer household note",
    mood: "great",
    details: { clientSyncRevision: 20 },
    syncStatus: "synced",
  };
  const attempts: ConflictEntry[] = [];

  const result = await retryCareEntryMutationAfterConflict({
    error: { status: 409 },
    input,
    isConflict: (error) =>
      (error as { status?: number }).status === 409,
    fetchCurrent: async () => server,
    rebase: (local, current) => {
      const rebased = rebaseCareEntryAfterConflict(
        local,
        current,
        local.pendingSyncPatch ?? {},
      );
      return {
        ...rebased,
        details: {
          ...(rebased.details ?? {}),
          clientSyncRevision: 21,
        },
      };
    },
    mutate: async (rebased) => {
      attempts.push(rebased);
      return rebased;
    },
  });

  assert.equal(attempts.length, 1);
  assert.equal(result.note, "Local note");
  assert.equal(result.mood, "great");
  assert.equal(result.details?.clientSyncRevision, 21);
});

test("a failed conflict retry carries the rebased revision into the next attempt", async () => {
  const rebasedInput = {
    id: "server_1",
    note: "Local note",
    details: { clientSyncRevision: 21 },
  };

  await assert.rejects(
    retryCareEntryMutationAfterConflict({
      error: { status: 409 },
      input: {
        id: "server_1",
        note: "Local note",
        details: { clientSyncRevision: 3 },
      },
      isConflict: () => true,
      fetchCurrent: async () => ({
        id: "server_1",
        details: { clientSyncRevision: 20 },
      }),
      rebase: () => rebasedInput,
      mutate: async () => {
        throw new Error("offline");
      },
    }),
    (error: unknown) =>
      error instanceof CareEntryConflictRetryError &&
      error.rebasedInput.details?.clientSyncRevision === 21,
  );
});

test("update acknowledgement replaces local fields and clears retry state", () => {
  const route = [{ lat: 37.8, lon: -122.1, t: 1 }];

  const acknowledged = adoptServerEntry(
    {
      id: "server_walk",
      title: "Pending title",
      occurredAt: "2026-07-30T18:00:00.000Z",
      syncStatus: "failed" as const,
      syncError: "Saved locally. Refresh to retry sync.",
      details: {
        route,
        routeDistanceM: 410,
        routeName: "Pending route name",
      },
    },
    {
      id: "server_walk",
      title: "Saved title",
      occurredAt: "2026-07-30T18:02:00.000Z",
      details: {
        routeName: "Saved route name",
        walkLifecycle: "completed",
      },
    },
  );

  assert.deepEqual(acknowledged, {
    id: "server_walk",
    title: "Saved title",
    occurredAt: "2026-07-30T18:02:00.000Z",
    syncStatus: "synced",
    syncError: undefined,
    details: {
      routeName: "Saved route name",
      walkLifecycle: "completed",
      route,
      routeDistanceM: 410,
    },
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMutationQueue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("serializes entry updates and only applies the newest acknowledgement", async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const calls: string[] = [];
  const successes: Array<[string, string]> = [];
  const failures: string[] = [];
  const queue = createSerializedCareEntryMutationQueue<string, string>({
    mutate: (_id, value) => {
      calls.push(value);
      return value === "first" ? first.promise : second.promise;
    },
    onSuccess: (_id, value, result) => {
      successes.push([value, result]);
    },
    onFailure: (_id, value) => {
      failures.push(value);
    },
  });

  queue.enqueue("server_walk", "first");
  queue.enqueue("server_walk", "second");
  assert.deepEqual(calls, ["first"]);

  first.resolve("server-first");
  await flushMutationQueue();
  assert.deepEqual(calls, ["first", "second"]);
  assert.deepEqual(successes, []);

  second.resolve("server-second");
  await flushMutationQueue();
  assert.deepEqual(successes, [["second", "server-second"]]);
  assert.deepEqual(failures, []);
});

test("ignores an older failure while a newer serialized update is waiting", async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const calls: string[] = [];
  const failures: string[] = [];
  const successes: string[] = [];
  const queue = createSerializedCareEntryMutationQueue<string, string>({
    mutate: (_id, value) => {
      calls.push(value);
      return value === "first" ? first.promise : second.promise;
    },
    onSuccess: (_id, value) => {
      successes.push(value);
    },
    onFailure: (_id, value) => {
      failures.push(value);
    },
  });

  queue.enqueue("server_walk", "first");
  queue.enqueue("server_walk", "second");
  first.reject(new Error("old request failed"));
  await flushMutationQueue();
  assert.deepEqual(calls, ["first", "second"]);
  assert.deepEqual(failures, []);

  second.reject(new Error("latest request failed"));
  await flushMutationQueue();
  assert.deepEqual(failures, ["second"]);
  assert.deepEqual(successes, []);
});

test("cancelling an entry mutation suppresses its result and queued update", async () => {
  const first = deferred<string>();
  const calls: string[] = [];
  const outcomes: string[] = [];
  const queue = createSerializedCareEntryMutationQueue<string, string>({
    mutate: (_id, value) => {
      calls.push(value);
      return first.promise;
    },
    onSuccess: () => outcomes.push("success"),
    onFailure: () => outcomes.push("failure"),
  });

  queue.enqueue("server_walk", "first");
  queue.enqueue("server_walk", "second");
  queue.cancel("server_walk");
  first.resolve("server-first");
  await flushMutationQueue();

  assert.deepEqual(calls, ["first"]);
  assert.deepEqual(outcomes, []);
});

test("a timed-out mutation aborts its request and releases the queued update", async () => {
  const first = deferred<string>();
  const calls: string[] = [];
  const signals: AbortSignal[] = [];
  const successes: string[] = [];
  const timers = new Map<number, () => void>();
  let nextTimerId = 0;
  const queue = createSerializedCareEntryMutationQueue<string, string>({
    timeoutMs: 5,
    timeoutScheduler: {
      schedule: (callback) => {
        nextTimerId += 1;
        timers.set(nextTimerId, callback);
        return nextTimerId;
      },
      cancel: (handle) => {
        timers.delete(handle as number);
      },
    },
    mutate: (_id, value, signal) => {
      calls.push(value);
      signals.push(signal);
      return value === "first"
        ? first.promise
        : Promise.resolve("server-second");
    },
    onSuccess: (_id, value) => successes.push(value),
    onFailure: () => {},
  });

  queue.enqueue("server_walk", "first");
  queue.enqueue("server_walk", "second");
  const firstTimeout = timers.get(1);
  timers.delete(1);
  firstTimeout?.();
  await flushMutationQueue();

  assert.equal(signals[0]?.aborted, true);
  assert.equal(signals[1]?.aborted, false);
  assert.deepEqual(calls, ["first", "second"]);
  assert.deepEqual(successes, ["second"]);
  assert.equal(timers.size, 0);
});

test("the latest timed-out mutation reports a stable retryable failure", async () => {
  const timers = new Map<number, () => void>();
  const failures: unknown[] = [];
  const calls: string[] = [];
  let nextTimerId = 0;
  const queue = createSerializedCareEntryMutationQueue<string, string>({
    timeoutMs: 7,
    timeoutScheduler: {
      schedule: (callback) => {
        nextTimerId += 1;
        timers.set(nextTimerId, callback);
        return nextTimerId;
      },
      cancel: (handle) => {
        timers.delete(handle as number);
      },
    },
    mutate: (_id, value) => {
      calls.push(value);
      return value === "hung"
        ? new Promise<string>(() => {})
        : Promise.resolve("saved");
    },
    onSuccess: () => {},
    onFailure: (_id, _value, error) => failures.push(error),
  });

  queue.enqueue("server_walk", "hung");
  const timeout = timers.get(1);
  timers.delete(1);
  timeout?.();
  await flushMutationQueue();

  assert.equal(failures.length, 1);
  assert.equal(
    failures[0] instanceof CareSyncMutationTimeoutError,
    true,
  );
  assert.equal(
    (failures[0] as CareSyncMutationTimeoutError).timeoutMs,
    7,
  );

  queue.enqueue("server_walk", "retry");
  await flushMutationQueue();
  assert.deepEqual(calls, ["hung", "retry"]);
});

test("a cancelled or erased temp create deletes its acknowledged server row", async () => {
  const deleted: string[] = [];
  const serverEntry = {
    id: "server_walk",
    title: "Walk",
    occurredAt: "2026-07-30T18:00:00.000Z",
  };

  const cancelled = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: {
      id: "temp_walk",
      title: "Walk",
      occurredAt: "2026-07-30T18:00:00.000Z",
    },
    serverEntry,
    tempWasCancelled: true,
    eraseGenerationAtStart: 3,
    currentEraseGeneration: 3,
    deleteServerEntry: async (id) => {
      deleted.push(id);
    },
  });
  const erased = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: undefined,
    serverEntry,
    tempWasCancelled: false,
    eraseGenerationAtStart: 3,
    currentEraseGeneration: 4,
    deleteServerEntry: async (id) => {
      deleted.push(id);
    },
  });
  const offlineDelete = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: undefined,
    serverEntry,
    tempWasCancelled: true,
    eraseGenerationAtStart: 3,
    currentEraseGeneration: 3,
    deleteServerEntry: async () => {
      throw new Error("offline");
    },
  });

  assert.deepEqual(cancelled, {
    status: "discarded",
    serverEntryId: "server_walk",
    deleteSucceeded: true,
  });
  assert.deepEqual(erased, {
    status: "discarded",
    serverEntryId: "server_walk",
    deleteSucceeded: true,
  });
  assert.deepEqual(offlineDelete, {
    status: "discarded",
    serverEntryId: "server_walk",
    deleteSucceeded: false,
  });
  assert.deepEqual(deleted, ["server_walk", "server_walk"]);
});

test("a live temp create adopts the server identity without deleting it", async () => {
  const deleted: string[] = [];
  const route = [{ lat: 37.8, lon: -122.1, t: 1 }];

  const result = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: {
      id: "temp_walk",
      title: "Local walk",
      occurredAt: "2026-07-30T18:00:00.000Z",
      syncStatus: "pending" as const,
      details: { route, routeDistanceM: 410 },
    },
    serverEntry: {
      id: "server_walk",
      title: "Saved walk",
      occurredAt: "2026-07-30T18:01:00.000Z",
      details: { clientKey: "temp_walk" },
    },
    tempWasCancelled: false,
    eraseGenerationAtStart: 3,
    currentEraseGeneration: 3,
    deleteServerEntry: async (id) => {
      deleted.push(id);
    },
  });

  assert.equal(result.status, "adopted");
  if (result.status !== "adopted") assert.fail("expected adopted entry");
  assert.deepEqual(result.entry, {
    id: "server_walk",
    title: "Saved walk",
    occurredAt: "2026-07-30T18:01:00.000Z",
    syncStatus: "synced",
    syncError: undefined,
    details: {
      clientKey: "temp_walk",
      route,
      routeDistanceM: 410,
    },
  });
  assert.deepEqual(deleted, []);
});

test("an edit queued during create keeps the server id and remains pending", () => {
  const prepared = applyQueuedPatchToAcknowledgedEntry(
    {
      id: "server_walk",
      title: "Initial walk",
      occurredAt: "2026-07-30T18:00:00.000Z",
      syncStatus: "synced" as const,
      syncError: undefined,
      details: { clientKey: "temp_walk" },
    },
    {
      id: "temp_walk",
      title: "Edited while saving",
      syncStatus: "synced",
      syncError: "stale error",
      pendingSyncPatch: { title: "Edited while saving" },
    },
  );

  assert.deepEqual(prepared, {
    id: "server_walk",
    title: "Edited while saving",
    occurredAt: "2026-07-30T18:00:00.000Z",
    syncStatus: "pending",
    syncError: undefined,
    pendingSyncPatch: { title: "Edited while saving" },
    details: { clientKey: "temp_walk" },
  });
});

test("an edit queued during create stays local when sign-out happens before acknowledgement", () => {
  const prepared = applyQueuedPatchToAcknowledgedEntry(
    {
      id: "server_walk",
      title: "Initial walk",
      occurredAt: "2026-07-30T18:00:00.000Z",
      syncStatus: "synced" as const,
      syncError: undefined,
      details: { clientKey: "temp_walk" },
    },
    {
      title: "Edited after sign-out",
      note: "Keep this exact note",
      pendingSyncPatch: {
        title: "Edited after sign-out",
        note: "Keep this exact note",
      },
    },
    false,
  );

  assert.deepEqual(prepared, {
    id: "server_walk",
    title: "Edited after sign-out",
    note: "Keep this exact note",
    occurredAt: "2026-07-30T18:00:00.000Z",
    syncStatus: "local",
    syncError: "Saved on this device.",
    pendingSyncPatch: {
      title: "Edited after sign-out",
      note: "Keep this exact note",
    },
    details: { clientKey: "temp_walk" },
  });
});

test("offline edits remain local and preserve the newest patch", () => {
  const edited = prepareCareEntryForOfflineEdit(
    {
      id: "server_walk",
      title: "Older server title",
      occurredAt: "2026-07-30T18:00:00.000Z",
      syncStatus: "pending" as const,
    },
    {
      title: "Newest offline title",
      note: "Do not let the stale acknowledgement replace this",
    },
    {
      title: "Newest offline title",
      note: "Do not let the stale acknowledgement replace this",
    },
  );

  assert.deepEqual(edited, {
    id: "server_walk",
    title: "Newest offline title",
    note: "Do not let the stale acknowledgement replace this",
    occurredAt: "2026-07-30T18:00:00.000Z",
    syncStatus: "local",
    syncError: "Saved on this device.",
    pendingSyncPatch: {
      title: "Newest offline title",
      note: "Do not let the stale acknowledgement replace this",
    },
  });
});

test("hydration makes interrupted create and update mutations retryable", () => {
  const recovered = recoverInterruptedCareEntryMutations([
    {
      id: "temp_walk",
      title: "Creating walk",
      syncStatus: "pending" as const,
    },
    {
      id: "server_meal",
      title: "Updating breakfast",
      syncStatus: "pending" as const,
      pendingSyncPatch: { title: "Updating breakfast" },
    },
    {
      id: "server_note",
      title: "Already synced",
      syncStatus: "synced" as const,
    },
  ]);

  assert.deepEqual(
    recovered.map((entry) => [
      entry.id,
      entry.syncStatus,
      entry.syncError,
    ]),
    [
      [
        "temp_walk",
        "failed",
        "Previous sync was interrupted. Ready to retry.",
      ],
      [
        "server_meal",
        "failed",
        "Previous sync was interrupted. Ready to retry.",
      ],
      ["server_note", "synced", undefined],
    ],
  );
});

test("lost create response migrates the newest temp snapshot onto the real server id", () => {
  const migrated = migrateAcknowledgedTempEntryForRetry(
    {
      id: "temp_walk",
      title: "Newest edited title",
      note: "Edited while the first create response was lost",
      occurredAt: "2026-07-30T18:05:00.000Z",
      syncStatus: "failed" as const,
      pendingSyncPatch: {
        title: "Newest edited title",
        note: "Edited while the first create response was lost",
      },
      details: {
        routeName: "Newest route",
        route: [{ lat: 37.8, lon: -122.1, t: 1 }],
      },
    },
    {
      id: "server_walk",
      title: "Original create title",
      occurredAt: "2026-07-30T18:00:00.000Z",
      details: {
        clientKey: "temp_walk",
        routeName: "Original route",
        walkLifecycle: "completed",
      },
    },
  );

  assert.deepEqual(migrated, {
    id: "server_walk",
    title: "Newest edited title",
    note: "Edited while the first create response was lost",
    occurredAt: "2026-07-30T18:05:00.000Z",
    syncStatus: "failed",
    syncError:
      "The server saved the first version. Ready to sync your latest changes.",
    pendingSyncPatch: {
      title: "Newest edited title",
      note: "Edited while the first create response was lost",
    },
    details: {
      clientKey: "temp_walk",
      routeName: "Newest route",
      walkLifecycle: "completed",
      route: [{ lat: 37.8, lon: -122.1, t: 1 }],
    },
  });
});

test("refresh migration keeps the edited temp snapshot retryable instead of accepting stale create fields", () => {
  const [merged] = mergeServerAndLocalEntries(
    [
      {
        id: "temp_walk",
        title: "Newest edited title",
        note: "Latest note",
        occurredAt: "2026-07-30T18:05:00.000Z",
        syncStatus: "failed" as const,
        pendingSyncPatch: {
          title: "Newest edited title",
          note: "Latest note",
        },
      },
    ],
    [
      {
        id: "server_walk",
        title: "Original create title",
        occurredAt: "2026-07-30T18:00:00.000Z",
        details: { clientKey: "temp_walk" },
      },
    ],
  );

  assert.equal(merged.id, "server_walk");
  assert.equal(merged.title, "Newest edited title");
  assert.equal(merged.note, "Latest note");
  assert.equal(merged.syncStatus, "failed");
  assert.equal(shouldRetryUpdate(merged), true);
});

test("create acknowledgement finds a row that refresh already migrated to the server id", async () => {
  const entries = [
    {
      id: "server_walk",
      title: "Newest edited title",
      occurredAt: "2026-07-30T18:05:00.000Z",
      syncStatus: "failed" as const,
      details: { clientKey: "temp_walk" },
    },
  ];
  const existing = findCreatedCareEntryLocalSnapshot(
    entries,
    "temp_walk",
    "server_walk",
  );
  const deleted: string[] = [];
  const result = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: existing,
    serverEntry: {
      id: "server_walk",
      title: "Original create title",
      occurredAt: "2026-07-30T18:00:00.000Z",
      details: { clientKey: "temp_walk" },
    },
    tempWasCancelled: false,
    eraseGenerationAtStart: 1,
    currentEraseGeneration: 1,
    deleteServerEntry: async (id) => {
      deleted.push(id);
    },
  });

  assert.equal(existing?.id, "server_walk");
  assert.equal(result.status, "adopted");
  if (result.status !== "adopted") assert.fail("expected adopted entry");
  assert.equal(result.entry.title, "Newest edited title");
  assert.equal(result.entry.syncStatus, "failed");
  assert.deepEqual(deleted, []);
});

test("create acknowledgement owns the same-id synced retry decision", async () => {
  const result = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: {
      id: "server_walk",
      title: "Fresh same-id snapshot",
      occurredAt: "2026-07-30T18:05:00.000Z",
      syncStatus: "synced" as const,
      details: { clientKey: "temp_walk" },
    },
    serverEntry: {
      id: "server_walk",
      title: "Acknowledged server snapshot",
      occurredAt: "2026-07-30T18:00:00.000Z",
      details: { clientKey: "temp_walk" },
    },
    createWasRetried: true,
    tempWasCancelled: false,
    eraseGenerationAtStart: 1,
    currentEraseGeneration: 1,
    deleteServerEntry: async () => {},
  });

  assert.equal(result.status, "adopted");
  if (result.status !== "adopted") assert.fail("expected adopted entry");
  assert.equal(result.entry.id, "server_walk");
  assert.equal(result.entry.title, "Fresh same-id snapshot");
  assert.equal(result.entry.syncStatus, "failed");
});

test("missing temp snapshot alone does not delete an acknowledged create", async () => {
  const deleted: string[] = [];
  const result = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: undefined,
    serverEntry: {
      id: "server_walk",
      title: "Walk",
      occurredAt: "2026-07-30T18:00:00.000Z",
      details: { clientKey: "temp_walk" },
    },
    tempWasCancelled: false,
    eraseGenerationAtStart: 1,
    currentEraseGeneration: 1,
    deleteServerEntry: async (id) => {
      deleted.push(id);
    },
  });

  assert.equal(result.status, "adopted");
  assert.deepEqual(deleted, []);
});

test("idempotent response to a recovered create keeps the edited temp snapshot retryable", async () => {
  const result = await reconcileCreatedCareEntryAcknowledgement({
    localEntry: {
      id: "temp_walk",
      title: "Newest recovered title",
      note: "This edit survived restart",
      occurredAt: "2026-07-30T18:05:00.000Z",
      syncStatus: "failed" as const,
      pendingSyncPatch: {
        title: "Newest recovered title",
        note: "This edit survived restart",
      },
      details: { routeName: "Newest route" },
    },
    serverEntry: {
      id: "server_walk",
      title: "Stale original title",
      note: "Original note",
      occurredAt: "2026-07-30T18:00:00.000Z",
      details: {
        clientKey: "temp_walk",
        routeName: "Original route",
      },
    },
    createWasRetried: true,
    tempWasCancelled: false,
    eraseGenerationAtStart: 1,
    currentEraseGeneration: 1,
    deleteServerEntry: async () => {},
  });

  assert.equal(result.status, "adopted");
  if (result.status !== "adopted") assert.fail("expected adopted entry");
  assert.equal(result.entry.id, "server_walk");
  assert.equal(result.entry.title, "Newest recovered title");
  assert.equal(result.entry.note, "This edit survived restart");
  assert.equal(result.entry.syncStatus, "failed");
  assert.equal(shouldRetryUpdate(result.entry), true);
  assert.deepEqual(result.entry.details, {
    clientKey: "temp_walk",
    routeName: "Newest route",
  });
});

test("the dedicated deletion ledger survives hydration and prevents restart resurrection", () => {
  const raw = JSON.stringify([
    "server_cancelled",
    "server_cancelled",
    "",
    42,
  ]);
  const hydratedIds = normalizeDiscardedServerEntryIds(JSON.parse(raw));

  assert.deepEqual(hydratedIds, ["server_cancelled"]);
  assert.deepEqual(
    filterDiscardedServerEntries(
      [
        { id: "server_cancelled", title: "Deleted walk" },
        { id: "server_safe", title: "Breakfast" },
      ],
      hydratedIds,
      hydratedIds,
    ),
    [{ id: "server_safe", title: "Breakfast" }],
  );
});

test("ledger hydration unions a cancellation recorded while storage is being read", () => {
  const cachedIds = normalizeDiscardedServerEntryIds(["server_old"]);
  const cancelledDuringRead = addDiscardedServerEntryId(
    [],
    "server_new",
  );

  assert.deepEqual(
    normalizeDiscardedServerEntryIds([
      ...cachedIds,
      ...cancelledDuringRead,
    ]),
    ["server_old", "server_new"],
  );
});

test("a durable cancelled client key suppresses its server row after process death", () => {
  assert.deepEqual(
    filterDiscardedServerEntries(
      [
        {
          id: "server_cancelled",
          details: { clientKey: "temp_cancelled" },
        },
        { id: "server_safe", details: { clientKey: "temp_safe" } },
      ],
      ["temp_cancelled"],
    ),
    [{ id: "server_safe", details: { clientKey: "temp_safe" } }],
  );
});

test("one empty refresh does not make a late cancelled create eligible to reappear", () => {
  const durableLedger = ["temp_cancelled"];
  const firstRefresh: Array<{
    id: string;
    details?: Record<string, unknown>;
  }> = [];

  assert.deepEqual(
    filterDiscardedServerEntries(firstRefresh, durableLedger),
    [],
  );
  // The CREATE commits after that empty full-list response. Keeping the
  // clientKey ledger still suppresses it on the next refresh.
  assert.deepEqual(
    filterDiscardedServerEntries(
      [
        {
          id: "server_late",
          details: { clientKey: "temp_cancelled" },
        },
      ],
      durableLedger,
    ),
    [],
  );
});

test("duplicate cleanup keeps the shared client key when any row deletion fails", async () => {
  const marked: string[] = [];
  const cleared: string[] = [];
  const deleted: string[] = [];

  const allRemoved = await cleanupDiscardedServerEntryRows({
    rows: [{ id: "server_first" }, { id: "server_second" }],
    markDiscarded: async (id) => {
      marked.push(id);
    },
    deleteEntry: async (id) => {
      deleted.push(id);
      if (id === "server_second") throw new Error("offline");
    },
    clearDiscarded: async (id) => {
      cleared.push(id);
    },
  });

  assert.equal(allRemoved, false);
  assert.deepEqual(marked, ["server_first", "server_second"]);
  assert.deepEqual(deleted, ["server_first", "server_second"]);
  assert.deepEqual(cleared, ["server_first"]);
});

test("duplicate cleanup removes observed rows but retains the shared client key", async () => {
  const cleared: string[] = [];

  const allRemoved = await cleanupDiscardedServerEntryRows({
    rows: [{ id: "server_first" }, { id: "server_second" }],
    markDiscarded: async () => {},
    deleteEntry: async () => {},
    clearDiscarded: async (id) => {
      cleared.push(id);
    },
  });

  assert.equal(allRemoved, true);
  assert.deepEqual(cleared, ["server_first", "server_second"]);
});

test("refresh filtering includes tombstones added while deletion retries are in flight", () => {
  const snapshotAtRefreshStart = ["server_old"];
  const currentAfterAwait: string[] = [];
  const addedAndSuccessfullyDeletedDuringAwait = ["server_new"];

  assert.deepEqual(
    filterDiscardedServerEntries(
      [
        { id: "server_old" },
        { id: "server_new" },
        { id: "server_safe" },
      ],
      snapshotAtRefreshStart,
      currentAfterAwait,
      addedAndSuccessfullyDeletedDuringAwait,
    ),
    [{ id: "server_safe" }],
  );
});

test("successful server deletion removes only its durable tombstone", () => {
  const withTwo = addDiscardedServerEntryId(
    addDiscardedServerEntryId([], "server_old"),
    "server_new",
  );

  assert.deepEqual(withTwo, ["server_old", "server_new"]);
  assert.deepEqual(
    removeDiscardedServerEntryId(withTwo, "server_old"),
    ["server_new"],
  );
});

test("delete failure restoration replaces an existing row instead of duplicating it", () => {
  const restored = restoreEntryAfterDeleteFailure(
    [
      { id: "server_walk", title: "Server refresh copy" },
      { id: "server_meal", title: "Breakfast" },
    ],
    { id: "server_walk", title: "Owner's local walk" },
  );

  assert.deepEqual(restored, [
    { id: "server_walk", title: "Owner's local walk" },
    { id: "server_meal", title: "Breakfast" },
  ]);
  assert.equal(
    restored.filter((entry) => entry.id === "server_walk").length,
    1,
  );
});

test("delete failure restoration makes a cancelled pending edit retryable", () => {
  const [restored] = restoreEntryAfterDeleteFailure(
    [],
    {
      id: "server_walk",
      title: "Edited walk",
      syncStatus: "pending" as const,
      syncError: undefined,
      pendingSyncPatch: { title: "Edited walk" },
    },
  );

  assert.equal(restored.syncStatus, "failed");
  assert.match(restored.syncError ?? "", /retry/i);
  assert.equal(shouldRetryUpdate(restored), true);
});

test("serializes durable tombstone writes so a later clear cannot be overtaken", async () => {
  const firstWrite = deferred<void>();
  const writes: string[][] = [];
  const writer = createSerializedCareSyncWriter<string[]>(async (value) => {
    writes.push(value);
    if (writes.length === 1) await firstWrite.promise;
  });

  const addWrite = writer.enqueue(["server_cancelled"]);
  const clearWrite = writer.enqueue([]);
  assert.deepEqual(writes, [["server_cancelled"]]);

  firstWrite.resolve();
  await addWrite;
  await clearWrite;
  assert.deepEqual(writes, [["server_cancelled"], []]);
});

test("a rejected durable write does not stall the next queued write", async () => {
  const firstGate = deferred<void>();
  const writes: string[] = [];
  const writer = createSerializedCareSyncWriter<string>(
    async (value) => {
      writes.push(value);
      if (value === "first") {
        await firstGate.promise;
        throw new Error("storage failed");
      }
    },
  );

  const firstResult = assert.rejects(
    writer.enqueue("first"),
    /storage failed/,
  );
  const secondResult = writer.enqueue("second");
  firstGate.resolve();

  await firstResult;
  await secondResult;
  assert.deepEqual(writes, ["first", "second"]);
});

test("owner wipe preserves opaque cleanup ids until final remote deletion removes the ledger", async () => {
  const writes: Array<string[] | null> = [];
  const writer = createSerializedCareSyncWriter<string[] | null>(
    async (value) => {
      writes.push(value);
    },
  );
  const cleanupLedger = normalizeDiscardedServerEntryIds([
    "server_orphan",
    "temp_cancelled",
  ]);

  // A local-data wipe re-persists only the opaque deletion ledger.
  await writer.enqueue(cleanupLedger);
  // Remote absence/delete confirmation is the only event that removes it.
  await writer.enqueue(null);

  assert.deepEqual(writes, [
    ["server_orphan", "temp_cancelled"],
    null,
  ]);
});

test("owner wipe removes every WoofWatcher key except the remote cleanup ledger", () => {
  assert.deepEqual(
    selectWoofWatcherKeysForOwnerWipe(
      [
        "woofwatcher.v2.state",
        "woofwatcher.avatar",
        "woofwatcher.v2.discarded-server-entry-ids",
        "unrelated.app.state",
      ],
      "woofwatcher.v2.discarded-server-entry-ids",
    ),
    ["woofwatcher.v2.state", "woofwatcher.avatar"],
  );
});
