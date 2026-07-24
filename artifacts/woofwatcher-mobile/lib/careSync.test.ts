import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCareSyncOutbox,
  deriveCareSyncDashboard,
  createCareDocSyncCoordinator,
  parseCareDocSyncSnapshot,
  summarizeCareDocConflicts,
  reconcileCareDocFromServer,
  isUnsyncedEntry,
  isCareEntryConflictInHousehold,
  shouldRetryCreate,
  shouldRetryUpdate,
  buildCareEntryRefreshPlan,
  mergeServerAndLocalEntries,
  withSyncedStatus,
} from "./careSync.ts";
import * as careSyncModule from "./careSync.ts";

const {
  deriveCareDocConflictReviewAccess,
  formatCareDocConflictReview,
} = careSyncModule;

const CARE_DOC_HOUSEHOLD_ID =
  "11111111-1111-4111-8111-111111111111";
const OTHER_CARE_DOC_HOUSEHOLD_ID =
  "22222222-2222-4222-8222-222222222222";
const acceptSyntheticTestDoc = () => true;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
  assert.equal(dashboard.nextStep, "Retry sync so every caregiver sees the latest care.");
});

test("surfaces household refresh failure without claiming cached or local care was lost", () => {
  const dashboard = deriveCareSyncDashboard({
    outbox: deriveCareSyncOutbox([]),
    isLoaded: true,
    isSyncing: false,
    refreshError:
      "Couldn't reach the shared household. Cached and local care remain saved.",
    householdMemberCount: 2,
    totalEntries: 4,
  });

  assert.equal(dashboard.status, "attention");
  assert.equal(dashboard.title, "Household refresh failed");
  assert.equal(dashboard.actionLabel, "Retry refresh");
  assert.match(dashboard.message, /cached and local care remain saved/i);
  assert.match(dashboard.nextStep, /retry/i);
  assert.equal(dashboard.metrics[0].value, "4 entries");
});

test("document conflicts force bounded Sync Health attention without exposing values", () => {
  const conflicts = [
    {
      path: 'records[id="private-record-id"].note',
      base: { present: true as const, value: "sensitive base" },
      server: { present: true as const, value: "sensitive server" },
      local: { present: true as const, value: "sensitive local" },
      resolution: "local" as const,
    },
    {
      path: "dietProfile.primaryFood",
      base: { present: true as const, value: "base diet" },
      server: { present: true as const, value: "server diet" },
      local: { present: true as const, value: "local diet" },
      resolution: "local" as const,
    },
    {
      path: "$acknowledgedBase",
      base: { present: false as const },
      server: { present: true as const, value: { version: 8 } },
      local: { present: true as const, value: { version: 7 } },
      resolution: "local" as const,
    },
    {
      path: "profile.name",
      base: { present: true as const, value: "old" },
      server: { present: true as const, value: "remote" },
      local: { present: true as const, value: "local" },
      resolution: "local" as const,
    },
  ];
  const summaries = summarizeCareDocConflicts(conflicts, 3);
  assert.deepEqual(summaries, [
    "Records",
    "Diet profile",
    "Upgraded cache baseline",
    "+1 more",
  ]);
  assert.doesNotMatch(summaries.join(" "), /sensitive|private-record-id/);

  const dashboard = deriveCareSyncDashboard({
    outbox: deriveCareSyncOutbox([]),
    isLoaded: true,
    isSyncing: false,
    householdMemberCount: 2,
    totalEntries: 6,
    documentConflictCount: conflicts.length,
    documentSyncError: null,
  });
  assert.equal(dashboard.status, "attention");
  assert.equal(dashboard.title, "Care document needs review");
  assert.equal(dashboard.actionLabel, "Review");
  assert.match(dashboard.message, /4 household care conflicts/);
});

test("document conflicts and a refresh error stay visible together with Retry available", () => {
  const dashboard = deriveCareSyncDashboard({
    outbox: deriveCareSyncOutbox([]),
    isLoaded: true,
    isSyncing: false,
    householdMemberCount: 2,
    totalEntries: 6,
    documentConflictCount: 2,
    documentSyncError:
      "Household care sync needs a retry. Local care remains saved.",
  });

  assert.equal(dashboard.status, "attention");
  assert.equal(dashboard.actionLabel, "Retry sync");
  assert.match(dashboard.title, /review/i);
  assert.match(dashboard.message, /2 household care conflicts/i);
  assert.match(dashboard.message, /needs a retry/i);
  assert.match(dashboard.nextStep, /retry/i);
  assert.match(dashboard.nextStep, /review/i);
});

test("formats every conflict as a bounded path and bounded local/server alternatives", () => {
  assert.equal(
    typeof formatCareDocConflictReview,
    "function",
    "conflict review needs a bounded formatter",
  );
  if (!formatCareDocConflictReview) return;
  const longSecret = "private owner note ".repeat(20);
  const conflict = {
    path: 'records[id="private-record-id"].note',
    base: { present: true as const, value: "base" },
    server: { present: true as const, value: longSecret },
    local: { present: false as const },
    resolution: "local" as const,
  };

  const review = formatCareDocConflictReview(conflict, 48);

  assert.equal(review.path, 'records[id="private-record-id"].note');
  assert.equal(review.localAlternative, "Removed");
  assert.ok(review.serverAlternative.length <= 48);
  assert.match(review.serverAlternative, /…$/);
  assert.doesNotMatch(review.serverAlternative, new RegExp(longSecret));
});

test("pending or failed role lookup keeps active-scope conflicts in Sync Health", () => {
  assert.equal(
    typeof deriveCareDocConflictReviewAccess,
    "function",
    "conflict visibility needs a role-independent status model",
  );
  if (!deriveCareDocConflictReviewAccess) return;
  const conflicts = [
    {
      path: "profile.name",
      base: { present: true as const, value: "Phoenix" },
      server: { present: true as const, value: "Server Phoenix" },
      local: { present: true as const, value: "Local Phoenix" },
      resolution: "local" as const,
    },
  ];

  for (const viewerRole of [null, undefined]) {
    const access = deriveCareDocConflictReviewAccess({
      activeAuthenticatedScope: true,
      viewerRole,
      conflicts,
    });
    const dashboard = deriveCareSyncDashboard({
      outbox: deriveCareSyncOutbox([]),
      isLoaded: true,
      isSyncing: false,
      householdMemberCount: 1,
      totalEntries: 0,
      documentConflictCount: access.conflictCount,
    });

    assert.equal(access.conflictCount, 1);
    assert.deepEqual(access.ownerReviewConflicts, []);
    assert.equal(access.requiresOwnerReview, true);
    assert.equal(dashboard.status, "attention");
    assert.match(dashboard.message, /1 household care conflict/i);
  }
});

test("a signed-in non-owner sees conflict attention without sensitive alternatives", () => {
  assert.equal(typeof deriveCareDocConflictReviewAccess, "function");
  if (!deriveCareDocConflictReviewAccess) return;
  const conflicts = [
    {
      path: "dietProfile.vetNotes",
      base: { present: true as const, value: "base private note" },
      server: { present: true as const, value: "server private note" },
      local: { present: true as const, value: "local private note" },
      resolution: "local" as const,
    },
  ];
  const access = deriveCareDocConflictReviewAccess({
    activeAuthenticatedScope: true,
    viewerRole: "member",
    conflicts,
  });
  const dashboard = deriveCareSyncDashboard({
    outbox: deriveCareSyncOutbox([]),
    isLoaded: true,
    isSyncing: false,
    householdMemberCount: 2,
    totalEntries: 0,
    documentConflictCount: access.conflictCount,
  });

  assert.equal(access.conflictCount, 1);
  assert.deepEqual(access.ownerReviewConflicts, []);
  assert.equal(access.requiresOwnerReview, true);
  assert.equal(dashboard.status, "attention");
  assert.doesNotMatch(
    JSON.stringify({ access, dashboard }),
    /private note/i,
  );
});

test("keeps upgraded local care visible when no acknowledged base exists", () => {
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

  assert.equal(plan.status, "merge-without-base-and-push");
  assert.equal(plan.shouldPushLocal, true);
  assert.equal(plan.version, 5);
  assert.deepEqual(plan.doc, {
    updatedAt: "2026-06-11T09:00:00.000Z",
    profile: { name: "Phoenix" },
  });
  assert.equal(
    plan.message,
    "Preserved upgraded local care and household care for conflict review.",
  );
  assert.deepEqual(
    plan.conflicts.map((conflict) => conflict.path),
    ["$acknowledgedBase", "profile.name"],
  );
});

test("accepts server care document when it is newer than local cache", () => {
  const plan = reconcileCareDocFromServer({
    acknowledgedBase: {
      version: 4,
      doc: {
        updatedAt: "2026-06-11T08:00:00.000Z",
        profile: { name: "Old Phoenix" },
      },
    },
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

test("plans one merged push for newer local routines and newer server diet", () => {
  const baseDoc = {
    updatedAt: "2026-07-20T08:00:00.000Z",
    dietProfile: { primaryFood: "Base food" },
    routines: [{ id: "routine-1", label: "Breakfast" }],
  };
  const plan = reconcileCareDocFromServer({
    acknowledgedBase: { version: 7, doc: baseDoc },
    localDoc: {
      updatedAt: "2026-07-20T10:00:00.000Z",
      dietProfile: { primaryFood: "Base food" },
      routines: [{ id: "routine-1", label: "Early breakfast" }],
    },
    localVersion: 7,
    serverDoc: {
      updatedAt: "2026-07-20T09:00:00.000Z",
      dietProfile: { primaryFood: "Server food" },
      routines: [{ id: "routine-1", label: "Breakfast" }],
    },
    serverVersion: 8,
    serverUpdatedAt: "2026-07-20T09:00:00.000Z",
  });

  assert.equal(plan.status, "merge-and-push");
  assert.equal(plan.shouldPushLocal, true);
  assert.equal(plan.version, 8);
  assert.deepEqual(plan.doc, {
    updatedAt: "2026-07-20T10:00:00.000Z",
    dietProfile: { primaryFood: "Server food" },
    routines: [{ id: "routine-1", label: "Early breakfast" }],
  });
  assert.deepEqual(plan.conflicts, []);
});

test("conservatively merges an upgraded cache without a base and surfaces overlaps", () => {
  const plan = reconcileCareDocFromServer({
    localDoc: {
      updatedAt: "2026-07-20T10:00:00.000Z",
      dietProfile: { primaryFood: "Base food" },
      routines: [{ id: "routine-local", label: "Local routine" }],
    },
    localVersion: 7,
    serverDoc: {
      updatedAt: "2026-07-20T09:00:00.000Z",
      dietProfile: { primaryFood: "Server food" },
      routines: [{ id: "routine-server", label: "Server routine" }],
    },
    serverVersion: 8,
  });

  assert.equal(plan.status, "merge-without-base-and-push");
  assert.equal(plan.shouldPushLocal, true);
  assert.deepEqual(plan.doc.routines, [
    { id: "routine-local", label: "Local routine" },
    { id: "routine-server", label: "Server routine" },
  ]);
  assert.equal(plan.doc.dietProfile.primaryFood, "Base food");
  assert.deepEqual(
    plan.conflicts.map((conflict) => conflict.path),
    ["$acknowledgedBase", "dietProfile.primaryFood"],
  );
});

test("rejects a server envelope older than the coherent acknowledged base", () => {
  const localDoc = {
    updatedAt: "2026-07-20T10:00:00.000Z",
    dietProfile: { primaryFood: "Local food" },
    routines: [],
  };
  const plan = reconcileCareDocFromServer({
    acknowledgedBase: {
      version: 9,
      doc: {
        updatedAt: "2026-07-20T09:00:00.000Z",
        dietProfile: { primaryFood: "Acknowledged food" },
        routines: [],
      },
    },
    localDoc,
    localVersion: 9,
    serverDoc: {
      updatedAt: "2026-07-20T08:00:00.000Z",
      dietProfile: { primaryFood: "Regressed food" },
      routines: [],
    },
    serverVersion: 8,
  });

  assert.equal(plan.status, "reject-stale-server");
  assert.equal(plan.version, 9);
  assert.equal(plan.shouldPushLocal, false);
  assert.deepEqual(plan.doc, localDoc);
});

test("merge supersedes a temp entry once its server row arrives via clientKey", () => {
  const local = [
    { id: "temp_123_abc", title: "Breakfast", occurredAt: "2026-07-18T07:00:00.000Z", syncStatus: "failed" as const },
    { id: "temp_456_def", title: "Walk", occurredAt: "2026-07-18T08:00:00.000Z", syncStatus: "failed" as const },
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
  assert.deepEqual(
    merged.map((entry) => entry.id).sort(),
    ["srv_1", "temp_456_def"],
  );
});

test("document coordinator serializes rapid edits and never replaces newer local state", async () => {
  const first = deferred<{
    householdId: string;
    version: number;
    doc: Record<string, unknown>;
    updatedAt: string;
    updatedBy: string;
  }>();
  const putBodies: Array<{ version: number; doc: any }> = [];
  let snapshot: any = {
    currentDoc: {
      updatedAt: "2026-07-23T10:00:00.000Z",
      profile: { name: "A" },
    },
    serverVersion: 7,
    acknowledged: {
      version: 7,
      doc: {
        updatedAt: "2026-07-23T09:00:00.000Z",
        profile: { name: "Base" },
      },
    },
    conflicts: [],
    documentSyncError: null,
  };
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next: any) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      throw new Error("not used");
    },
    putRemote: async (body: {
      householdId: string;
      version: number;
      doc: any;
    }) => {
      putBodies.push(structuredClone(body));
      if (putBodies.length === 1) return first.promise;
      return {
        householdId: CARE_DOC_HOUSEHOLD_ID,
        version: 9,
        doc: body.doc,
        updatedAt: "2026-07-23T10:02:00.000Z",
        updatedBy: "user",
      };
    },
    now: () => "2026-07-23T10:02:00.000Z",
  });

  const pushA = coordinator.requestPush(
    CARE_DOC_HOUSEHOLD_ID,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  snapshot = {
    ...snapshot,
    currentDoc: {
      updatedAt: "2026-07-23T10:01:00.000Z",
      profile: { name: "B" },
    },
  };
  const pushB = coordinator.requestPush(
    CARE_DOC_HOUSEHOLD_ID,
  );
  assert.equal(putBodies.length, 1);

  first.resolve({
    householdId: CARE_DOC_HOUSEHOLD_ID,
    version: 8,
    doc: putBodies[0].doc,
    updatedAt: "2026-07-23T10:01:30.000Z",
    updatedBy: "user",
  });
  assert.equal(await pushA, true);
  assert.equal(await pushB, true);

  assert.equal(putBodies.length, 2);
  assert.equal(putBodies[1].doc.profile.name, "B");
  assert.equal(snapshot.currentDoc.profile.name, "B");
  assert.equal(snapshot.acknowledged.version, 9);
  assert.equal(snapshot.acknowledged.doc.profile.name, "B");
});

test("document coordinator merges a 409 with the latest local doc and keeps conflicts after retry", async () => {
  const started = deferred<void>();
  const first = deferred<never>();
  const putBodies: Array<{ version: number; doc: any }> = [];
  let snapshot: any = {
    currentDoc: {
      updatedAt: "2026-07-23T10:00:00.000Z",
      dietProfile: { primaryFood: "Base" },
      routines: [{ id: "r1", label: "Local breakfast" }],
    },
    serverVersion: 7,
    acknowledged: {
      version: 7,
      doc: {
        updatedAt: "2026-07-23T09:00:00.000Z",
        dietProfile: { primaryFood: "Base" },
        routines: [{ id: "r1", label: "Breakfast" }],
      },
    },
    conflicts: [
      {
        path: "profile.name",
        base: { present: true, value: "Old" },
        server: { present: true, value: "Remote" },
        local: { present: true, value: "Local" },
        resolution: "local",
      },
    ],
    documentSyncError: null,
  };
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next: any) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      throw new Error("not used");
    },
    putRemote: async (body: {
      householdId: string;
      version: number;
      doc: any;
    }) => {
      putBodies.push(structuredClone(body));
      if (putBodies.length === 1) {
        started.resolve();
        return first.promise;
      }
      return {
        householdId: CARE_DOC_HOUSEHOLD_ID,
        version: 9,
        doc: body.doc,
        updatedAt: "2026-07-23T10:03:00.000Z",
        updatedBy: "user",
      };
    },
    now: () => "2026-07-23T10:03:00.000Z",
  });

  const push = coordinator.requestPush(
    CARE_DOC_HOUSEHOLD_ID,
  );
  await started.promise;
  snapshot = {
    ...snapshot,
    currentDoc: {
      ...snapshot.currentDoc,
      updatedAt: "2026-07-23T10:02:00.000Z",
      routines: [{ id: "r1", label: "Early breakfast" }],
    },
  };
  first.reject({
    status: 409,
    data: {
      householdId: CARE_DOC_HOUSEHOLD_ID,
      version: 8,
      doc: {
        updatedAt: "2026-07-23T10:01:00.000Z",
        dietProfile: { primaryFood: "Server food" },
        routines: [{ id: "r1", label: "Breakfast" }],
      },
      updatedAt: "2026-07-23T10:01:00.000Z",
      updatedBy: "other-user",
    },
  });

  assert.equal(await push, true);
  assert.equal(putBodies[1].version, 8);
  assert.equal(putBodies[1].doc.dietProfile.primaryFood, "Server food");
  assert.equal(putBodies[1].doc.routines[0].label, "Early breakfast");
  assert.equal(snapshot.conflicts.length, 1);
  assert.equal(snapshot.conflicts[0].path, "profile.name");
});

test("document coordinator makes second conflicts and retryable failures visible", async () => {
  for (const failure of [
    {
      status: 409,
      data: {
        householdId: CARE_DOC_HOUSEHOLD_ID,
        version: 9,
        doc: {
          updatedAt: "2026-07-23T10:02:00.000Z",
          profile: { name: "Server" },
        },
        updatedAt: "2026-07-23T10:02:00.000Z",
        updatedBy: "other",
      },
    },
    { status: 503, data: { error: "unavailable" } },
    new Error("offline"),
  ]) {
    let calls = 0;
    let snapshot: any = {
      currentDoc: {
        updatedAt: "2026-07-23T10:00:00.000Z",
        profile: { name: "Local" },
      },
      serverVersion: 7,
      acknowledged: {
        version: 7,
        doc: {
          updatedAt: "2026-07-23T09:00:00.000Z",
          profile: { name: "Base" },
        },
      },
      conflicts: [],
      documentSyncError: null,
    };
    const coordinator = createCareDocSyncCoordinator({
      readSnapshot: () => snapshot,
      commitSnapshot: (next: any) => {
        snapshot = next;
      },
      normalizeDoc: (value: unknown) => value as any,
      isCompleteDoc: acceptSyntheticTestDoc,
      getRemote: async () => {
        throw new Error("not used");
      },
      putRemote: async () => {
        calls += 1;
        if (
          typeof failure === "object" &&
          failure &&
          "status" in failure &&
          failure.status === 409 &&
          calls === 1
        ) {
          throw {
            ...failure,
            data: { ...failure.data, version: 8 },
          };
        }
        throw failure;
      },
      now: () => "2026-07-23T10:03:00.000Z",
    });

    assert.equal(
      await coordinator.requestPush(CARE_DOC_HOUSEHOLD_ID),
      false,
    );
    assert.match(snapshot.documentSyncError, /retry|conflict/i);
    assert.ok(snapshot.conflicts.length > 0 || calls === 1);
  }
});

test("document coordinator rejects stale success envelopes and malformed conflicts", async () => {
  for (const outcome of [
    {
      kind: "success",
      value: {
        householdId: CARE_DOC_HOUSEHOLD_ID,
        version: 6,
        doc: { updatedAt: "2026-07-23T08:00:00.000Z" },
        updatedAt: "2026-07-23T08:00:00.000Z",
        updatedBy: "old",
      },
    },
    {
      kind: "conflict",
      value: {
        status: 409,
        data: {
          householdId: CARE_DOC_HOUSEHOLD_ID,
          version: "bad",
          doc: null,
        },
      },
    },
    {
      kind: "missing",
      value: { status: 404, data: { error: "missing" } },
    },
  ] as const) {
    let snapshot: any = {
      currentDoc: { updatedAt: "2026-07-23T10:00:00.000Z", profile: { name: "Local" } },
      serverVersion: 7,
      acknowledged: {
        version: 7,
        doc: { updatedAt: "2026-07-23T09:00:00.000Z", profile: { name: "Base" } },
      },
      conflicts: [],
      documentSyncError: null,
    };
    const coordinator = createCareDocSyncCoordinator({
      readSnapshot: () => snapshot,
      commitSnapshot: (next: any) => {
        snapshot = next;
      },
      normalizeDoc: (value: unknown) => value as any,
      isCompleteDoc: acceptSyntheticTestDoc,
      getRemote: async () => {
        throw new Error("not used");
      },
      putRemote: async () => {
        if (outcome.kind === "success") return outcome.value;
        throw outcome.value;
      },
      now: () => "2026-07-23T10:03:00.000Z",
    });

    assert.equal(
      await coordinator.requestPush(CARE_DOC_HOUSEHOLD_ID),
      false,
    );
    assert.equal(snapshot.serverVersion, 7);
    assert.equal(snapshot.acknowledged.version, 7);
    assert.ok(snapshot.documentSyncError);
  }
});

test("GET and PUT document work never overlaps and a hung H1 does not block H2", async () => {
  const h1Get = deferred<any>();
  const h2Put = deferred<any>();
  let activeNetwork = 0;
  let maxActiveNetwork = 0;
  let putCalls = 0;
  let snapshot: any = {
    currentDoc: { updatedAt: "2026-07-23T10:00:00.000Z", profile: { name: "H1" } },
    serverVersion: 7,
    acknowledged: {
      version: 7,
      doc: { updatedAt: "2026-07-23T09:00:00.000Z", profile: { name: "H1 base" } },
    },
    conflicts: [],
    documentSyncError: null,
  };
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next: any) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      activeNetwork += 1;
      maxActiveNetwork = Math.max(maxActiveNetwork, activeNetwork);
      try {
        return await h1Get.promise;
      } finally {
        activeNetwork -= 1;
      }
    },
    putRemote: async (body: {
      householdId: string;
      version: number;
      doc: any;
    }) => {
      putCalls += 1;
      activeNetwork += 1;
      maxActiveNetwork = Math.max(maxActiveNetwork, activeNetwork);
      try {
        if (putCalls === 1) return await h2Put.promise;
        return {
          householdId: OTHER_CARE_DOC_HOUSEHOLD_ID,
          version: body.version + 1,
          doc: body.doc,
          updatedAt: "2026-07-23T10:04:00.000Z",
          updatedBy: "user",
        };
      } finally {
        activeNetwork -= 1;
      }
    },
    now: () => "2026-07-23T10:04:00.000Z",
  });

  const staleH1 = coordinator.syncFromServer(
    CARE_DOC_HOUSEHOLD_ID,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  coordinator.beginGeneration();
  snapshot = {
    currentDoc: { updatedAt: "2026-07-23T10:03:00.000Z", profile: { name: "H2" } },
    serverVersion: 3,
    acknowledged: {
      version: 3,
      doc: { updatedAt: "2026-07-23T10:02:00.000Z", profile: { name: "H2 base" } },
    },
    conflicts: [],
    documentSyncError: null,
  };
  const h2Push = coordinator.requestPush(
    OTHER_CARE_DOC_HOUSEHOLD_ID,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(putCalls, 1, "H2 should not wait for the stale H1 queue");
  h2Put.resolve({
    householdId: OTHER_CARE_DOC_HOUSEHOLD_ID,
    version: 4,
    doc: snapshot.currentDoc,
    updatedAt: "2026-07-23T10:04:00.000Z",
    updatedBy: "user",
  });
  assert.equal(await h2Push, true);
  assert.equal(snapshot.acknowledged.version, 4);

  h1Get.resolve({
    householdId: CARE_DOC_HOUSEHOLD_ID,
    version: 8,
    doc: { updatedAt: "2026-07-23T10:01:00.000Z", profile: { name: "Old H1" } },
    updatedAt: "2026-07-23T10:01:00.000Z",
    updatedBy: "other",
  });
  assert.equal(await staleH1, false);
  assert.equal(snapshot.currentDoc.profile.name, "H2");
  assert.equal(maxActiveNetwork, 2, "only stale H1 may overlap the new generation");
});

test("care-document sync rejects a response for a different captured household", async () => {
  const h1 = "11111111-1111-4111-8111-111111111111";
  const h2 = "22222222-2222-4222-8222-222222222222";
  let requestedHouseholdId: string | undefined;
  let snapshot: any = {
    currentDoc: {
      updatedAt: "2026-07-23T10:00:00.000Z",
      profile: { name: "H1 local" },
    },
    serverVersion: 7,
    acknowledged: null,
    conflicts: [],
    documentSyncError: null,
  };
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next: any) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async (householdId: string) => {
      requestedHouseholdId = householdId;
      return {
        householdId: h2,
        version: 7,
        doc: {
          updatedAt: "2026-07-23T10:01:00.000Z",
          profile: { name: "H2 remote" },
        },
        updatedAt: "2026-07-23T10:01:00.000Z",
        updatedBy: "other",
      };
    },
    putRemote: async () => {
      throw new Error("unexpected PUT");
    },
    now: () => "2026-07-23T10:02:00.000Z",
  });

  assert.equal(await coordinator.syncFromServer(h1), false);
  assert.equal(requestedHouseholdId, h1);
  assert.equal(snapshot.currentDoc.profile.name, "H1 local");
  assert.equal(snapshot.serverVersion, 7);
  assert.match(snapshot.documentSyncError, /household/i);
});

test("care-document push rejects a 409 envelope for a different captured household", async () => {
  const h1 = "11111111-1111-4111-8111-111111111111";
  const h2 = "22222222-2222-4222-8222-222222222222";
  let requestedHouseholdId: string | undefined;
  let snapshot: any = {
    currentDoc: {
      updatedAt: "2026-07-23T10:02:00.000Z",
      profile: { name: "H1 local edit" },
    },
    serverVersion: 7,
    acknowledged: {
      version: 7,
      doc: {
        updatedAt: "2026-07-23T10:00:00.000Z",
        profile: { name: "H1 base" },
      },
    },
    conflicts: [],
    documentSyncError: null,
  };
  const coordinator = createCareDocSyncCoordinator({
    readSnapshot: () => snapshot,
    commitSnapshot: (next: any) => {
      snapshot = next;
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteDoc: acceptSyntheticTestDoc,
    getRemote: async () => {
      throw new Error("unexpected GET");
    },
    putRemote: async ({
      householdId,
    }: {
      householdId: string;
      version: number;
      doc: any;
    }) => {
      requestedHouseholdId = householdId;
      throw {
        status: 409,
        data: {
          householdId: h2,
          version: 8,
          doc: {
            updatedAt: "2026-07-23T10:01:00.000Z",
            profile: { name: "H2 conflict" },
          },
          updatedAt: "2026-07-23T10:01:00.000Z",
          updatedBy: "other",
        },
      };
    },
    now: () => "2026-07-23T10:03:00.000Z",
  });

  assert.equal(await coordinator.requestPush(h1), false);
  assert.equal(requestedHouseholdId, h1);
  assert.equal(snapshot.currentDoc.profile.name, "H1 local edit");
  assert.equal(snapshot.serverVersion, 7);
  assert.match(snapshot.documentSyncError, /household/i);
});

test("a care-entry 409 is a conflict only inside the captured household", () => {
  const h1 = CARE_DOC_HOUSEHOLD_ID;
  const h2 = OTHER_CARE_DOC_HOUSEHOLD_ID;
  assert.equal(
    isCareEntryConflictInHousehold(
      { status: 409, data: { householdId: h1 } },
      h1,
    ),
    true,
  );
  assert.equal(
    isCareEntryConflictInHousehold(
      { status: 409, data: { householdId: h2 } },
      h1,
    ),
    false,
  );
  assert.equal(
    isCareEntryConflictInHousehold(
      { status: 409, data: {} },
      h1,
    ),
    false,
  );
});

test("scoped document snapshot survives JSON restart with acknowledged base and conflicts", () => {
  const saved = {
    serverVersion: 8,
    currentDoc: {
      updatedAt: "2026-07-23T10:00:00.000Z",
      profile: { name: "Local" },
    },
    acknowledged: {
      version: 8,
      doc: {
        updatedAt: "2026-07-23T09:00:00.000Z",
        profile: { name: "Server" },
      },
    },
    conflicts: [
      {
        path: "profile.name",
        base: { present: true, value: "Base" },
        server: { present: true, value: "Server" },
        local: { present: true, value: "Local" },
        resolution: "local",
      },
    ],
    documentSyncError: "Retry after review.",
  };
  const restarted = parseCareDocSyncSnapshot({
    parsed: JSON.parse(JSON.stringify(saved)),
    fallbackDoc: {
      updatedAt: "1970-01-01T00:00:00.000Z",
      profile: { name: "Fallback" },
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteCurrentDoc: acceptSyntheticTestDoc,
  });

  assert.deepEqual(restarted, saved);
});

test("a legacy scoped snapshot without a baseline never manufactures one", () => {
  const restarted = parseCareDocSyncSnapshot({
    parsed: {
      serverVersion: 7,
      doc: {
        updatedAt: "2026-07-23T10:00:00.000Z",
        profile: { name: "Legacy local" },
      },
    },
    fallbackDoc: {
      updatedAt: "1970-01-01T00:00:00.000Z",
      profile: { name: "Fallback" },
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteCurrentDoc: acceptSyntheticTestDoc,
  });

  assert.equal(restarted.acknowledged, null);
  assert.equal(restarted.serverVersion, 7);
  assert.match(restarted.documentSyncError ?? "", /baseline/i);
  assert.equal(restarted.currentDoc.profile.name, "Legacy local");
});

test("a mismatched acknowledged baseline quarantines the scoped snapshot", () => {
  const restarted = parseCareDocSyncSnapshot({
    parsed: {
      serverVersion: 7,
      currentDoc: {
        updatedAt: "2026-07-23T10:00:00.000Z",
        profile: { name: "Local" },
      },
      acknowledged: {
        version: 6,
        doc: {
          updatedAt: "2026-07-23T09:00:00.000Z",
          profile: { name: "Wrong base" },
        },
      },
      conflicts: [],
      documentSyncError: null,
    },
    fallbackDoc: {
      updatedAt: "1970-01-01T00:00:00.000Z",
      profile: { name: "Fallback" },
    },
    normalizeDoc: (value: unknown) => value as any,
    isCompleteCurrentDoc: acceptSyntheticTestDoc,
  });

  assert.equal(restarted.cacheStatus, "corrupt");
  assert.equal(restarted.acknowledged, null);
  assert.equal(restarted.serverVersion, 0);
  assert.equal(restarted.currentDoc.profile.name, "Fallback");
});
