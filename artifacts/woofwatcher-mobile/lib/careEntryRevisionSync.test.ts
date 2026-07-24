import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyCareEntryMutationCallback,
  CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
  canApplyCareEntryUpdate,
  describeCareEntryConflictVersion,
  deriveCareSyncDashboard,
  deriveCareSyncOutbox,
  finalizeCareEntryMutation,
  isUnsyncedEntry,
  mergeServerAndLocalEntries,
  parseCachedCareEntriesWithRecovery,
  refreshThenResolveCareEntryConflict,
  resolveCareEntryConflict,
  sanitizeCareEntryConflictSnapshot,
  sanitizeCachedCareEntryConflict,
  shouldQueueCareEntryCreateFollowUp,
  shouldRetryCreate,
  shouldRetryUpdate,
} from "./careSync.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("final success commits the persisted server row so normalization and policy fields win", () => {
  const synced = finalizeCareEntryMutation(
    {
      id: "server-1",
      revision: 1,
      type: "Meal",
      details: { householdVisible: false, untrustedClientFlag: true },
      caregiverUserId: "client-supplied",
      syncStatus: "pending" as const,
    },
    {
      id: "server-1",
      revision: 2,
      type: "meal",
      details: { householdVisible: true, trustState: "server-approved" },
      caregiverUserId: "authenticated-user",
      syncStatus: "synced" as const,
    },
    "server-1",
  );

  assert.equal(synced.revision, 2);
  assert.equal(synced.type, "meal");
  assert.equal(synced.caregiverUserId, "authenticated-user");
  assert.deepEqual(synced.details, {
    householdVisible: true,
    trustState: "server-approved",
  });
  assert.equal(synced.syncStatus, "synced");
  assert.equal(synced.syncError, undefined);
});

test("refresh preserves pending fields but marks newer divergent server content conflicted", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 1,
        note: "My latest note",
        mood: "happy",
        details: { ownerDraft: true },
        syncStatus: "pending" as const,
        syncError: undefined,
      },
    ],
    [
      {
        id: "server-1",
        revision: 4,
        note: "Older server note",
        mood: "calm",
        details: { householdVisible: true },
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.revision, 4);
  assert.equal(merged[0]?.note, "My latest note");
  assert.equal(merged[0]?.mood, "happy");
  assert.deepEqual(merged[0]?.details, { ownerDraft: true });
  assert.equal(merged[0]?.syncStatus, "conflict");
  assert.match(merged[0]?.syncError ?? "", /household care changed/i);
});

test("refresh advances an existing conflict while preserving local status and message", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-conflict",
        revision: 2,
        note: "Local conflict",
        syncStatus: "conflict" as const,
        syncError: "conflict remains visible",
      },
    ],
    [
      {
        id: "server-conflict",
        revision: 7,
        note: "Household version",
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged[0]?.revision, 7);
  assert.equal(merged[0]?.note, "Local conflict");
  assert.equal(merged[0]?.syncStatus, "conflict");
  assert.equal(merged[0]?.syncError, "conflict remains visible");
  assert.deepEqual(merged[0]?.conflictServerSnapshot, {
    id: "server-conflict",
    revision: 7,
    note: "Household version",
  });
});

test("a conflict retains one bounded server alternative and supports both explicit resolutions", () => {
  const local = {
    id: "server-1",
    revision: 4,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "My preserved correction",
    mood: "happy",
    syncStatus: "conflict" as const,
    syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
    conflictServerSnapshot: {
      id: "server-1",
      revision: 3,
      note: "Stale household alternative",
    },
  };
  const household = {
    id: "server-1",
    revision: 4,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Household correction",
    mood: "calm",
    syncStatus: "synced" as const,
    syncError: undefined,
  };

  const keepLocal = resolveCareEntryConflict(
    local,
    household,
    "keep-local",
  );
  assert.ok(keepLocal);
  if (!keepLocal) return;
  assert.equal(keepLocal.shouldEnqueue, true);
  assert.equal(keepLocal.entry.note, "My preserved correction");
  assert.equal(keepLocal.entry.mood, "happy");
  assert.equal(keepLocal.entry.revision, 4);
  assert.equal(keepLocal.entry.syncStatus, "pending");
  assert.equal(keepLocal.entry.syncError, undefined);
  assert.equal(keepLocal.entry.conflictServerSnapshot, undefined);

  const useHousehold = resolveCareEntryConflict(
    local,
    household,
    "use-household",
  );
  assert.ok(useHousehold);
  if (!useHousehold) return;
  assert.equal(useHousehold.shouldEnqueue, false);
  assert.equal(useHousehold.entry.note, "Household correction");
  assert.equal(useHousehold.entry.mood, "calm");
  assert.equal(useHousehold.entry.revision, 4);
  assert.equal(useHousehold.entry.syncStatus, "synced");
  assert.equal(useHousehold.entry.syncError, undefined);
});

test("malformed cached conflict snapshots are dropped without making the conflict retryable", () => {
  const local = {
    id: "server-1",
    revision: 4,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "My saved edit",
    syncStatus: "conflict" as const,
    syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
  };
  const corruptSnapshots = [
    {
      id: "different-entry",
      revision: 4,
      type: "meal",
      occurredAt: "2026-07-23T08:00:00.000Z",
    },
    {
      id: "server-1",
      revision: 0,
      type: "meal",
      occurredAt: "2026-07-23T08:00:00.000Z",
    },
    {
      id: "server-1",
      revision: 4,
      type: "meal",
    },
    {
      id: "server-1",
      revision: 4,
      type: "meal",
      occurredAt: "2026-07-23T08:00:00.000Z",
      details: "unsafe",
    },
  ];

  for (const corrupt of corruptSnapshots) {
    assert.equal(
      sanitizeCareEntryConflictSnapshot(local.id, corrupt),
      undefined,
    );
    assert.equal(
      resolveCareEntryConflict(local, corrupt as typeof local, "use-household"),
      null,
    );
    const hydrated = sanitizeCachedCareEntryConflict({
      ...local,
      conflictServerSnapshot: corrupt,
    });
    assert.equal(hydrated.syncStatus, "conflict");
    assert.equal(hydrated.conflictServerSnapshot, undefined);
    assert.equal(shouldRetryUpdate(hydrated), false);
  }
});

test("malformed local conflict rows quarantine the exact raw cache instead of hydrating", async () => {
  const validConflict = {
    id: "server-1",
    revision: 4,
    type: "meal",
    title: "Breakfast",
    caregiver: "Alex",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Saved locally",
    syncStatus: "conflict" as const,
    syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
  };
  const malformedRows = [
    { ...validConflict, title: { unsafe: true } },
    { ...validConflict, type: null },
    { ...validConflict, occurredAt: "not-a-date" },
    { ...validConflict, syncStatus: "unknown" },
    { ...validConflict, syncError: { unsafe: true } },
    { ...validConflict, details: [] },
  ];

  for (const malformed of malformedRows) {
    const raw = JSON.stringify({
      entries: [malformed],
      untouched: "exact recovery evidence",
    });
    let quarantinedRaw: string | null = null;
    const result = await parseCachedCareEntriesWithRecovery({
      raw,
      value: JSON.parse(raw).entries,
      quarantine: async (exactRaw) => {
        quarantinedRaw = exactRaw;
        return true;
      },
    });
    assert.deepEqual(result, { status: "quarantined" });
    assert.equal(quarantinedRaw, raw);
  }

  const invalidSnapshot = {
    ...validConflict,
    conflictServerSnapshot: {
      id: "wrong-id",
      revision: 4,
      type: "meal",
      occurredAt: "2026-07-23T08:00:00.000Z",
    },
  };
  const validRaw = JSON.stringify({ entries: [invalidSnapshot] });
  const validResult = await parseCachedCareEntriesWithRecovery({
    raw: validRaw,
    value: [invalidSnapshot],
    quarantine: async () => {
      throw new Error("valid local row must not quarantine");
    },
  });
  assert.equal(validResult.status, "ready");
  if (validResult.status !== "ready") return;
  assert.equal(validResult.entries.length, 1);
  assert.equal(
    validResult.entries[0]?.conflictServerSnapshot,
    undefined,
  );
});

test("cached pending rows become retryable before an offline first refresh", () => {
  const hydrated = sanitizeCachedCareEntryConflict({
    id: "server-1",
    revision: 4,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Saved before restart",
    syncStatus: "pending" as const,
  });

  assert.equal(hydrated.syncStatus, "failed");
  assert.equal(hydrated.syncError, "Saved locally. Refresh to retry sync.");
  assert.equal(shouldRetryUpdate(hydrated), true);

  const settled = mergeServerAndLocalEntries(
    [hydrated],
    [
      {
        ...hydrated,
        syncStatus: "synced" as const,
        syncError: undefined,
      },
    ],
    {
      hasQueuedMutation: () => false,
      hasLiveCreate: () => false,
    },
  );
  assert.equal(settled[0]?.syncStatus, "synced");
  assert.equal(settled[0]?.syncError, undefined);
});

test("keep-local rejects malformed local conflict content before it reaches the mutation queue", () => {
  const household = {
    id: "server-1",
    revision: 4,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Household version",
  };
  const malformedLocal = {
    ...household,
    type: 42,
    note: "Malformed saved version",
    syncStatus: "conflict" as const,
  };

  assert.equal(
    resolveCareEntryConflict(
      malformedLocal as unknown as typeof household,
      household,
      "keep-local",
    ),
    null,
  );
});

test("an over-range cached conflict can adopt a valid refreshed household revision", () => {
  const malformedLocal = {
    id: "server-1",
    revision: 2_147_483_648,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Saved with corrupt revision",
    syncStatus: "conflict" as const,
    syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
  };
  const household = {
    id: "server-1",
    revision: 4,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Valid household revision",
    syncStatus: "synced" as const,
  };

  assert.equal(
    resolveCareEntryConflict(malformedLocal, household, "keep-local"),
    null,
  );
  const merged = mergeServerAndLocalEntries(
    [malformedLocal],
    [household],
  );
  assert.equal(merged[0]?.revision, 4);
  assert.equal(merged[0]?.syncStatus, "conflict");
  assert.equal(merged[0]?.conflictServerSnapshot?.revision, 4);
  assert.equal(
    merged[0]?.conflictServerSnapshot?.note,
    "Valid household revision",
  );
});

test("conflict comparison copy truthfully describes saved content and missing notes", () => {
  assert.deepEqual(
    describeCareEntryConflictVersion({
      id: "local",
      title: "Breakfast",
      type: "meal",
      note: "Added pumpkin",
      mood: "happy",
    }),
    {
      title: "Breakfast",
      type: "Meal",
      note: "Added pumpkin",
      mood: "Mood: happy",
    },
  );
  assert.deepEqual(
    describeCareEntryConflictVersion({
      id: "household",
      type: "walk",
    }),
    {
      title: "Walk",
      type: "Walk",
      note: "No note",
      mood: "Mood not logged",
    },
  );
  assert.deepEqual(
    describeCareEntryConflictVersion({
      id: "corrupt-cache",
      title: 42 as unknown as string,
      type: { bad: true } as unknown as string,
      note: ["unsafe"] as unknown as string,
      mood: false as unknown as string,
    }),
    {
      title: "Care log",
      type: "Care log",
      note: "No note",
      mood: "Mood not logged",
    },
  );
});

test("use-household refreshes and accepts only the freshly read server alternative", async () => {
  let current = {
    id: "server-1",
    revision: 4,
    note: "My saved edit",
    syncStatus: "conflict" as const,
    conflictServerSnapshot: {
      id: "server-1",
      revision: 4,
      type: "meal",
      occurredAt: "2026-07-23T08:00:00.000Z",
      note: "Previously displayed household edit",
    },
  };
  let refreshSerial = 3;
  const serialBefore = refreshSerial;

  const result = await refreshThenResolveCareEntryConflict({
    refresh: async () => {
      refreshSerial += 1;
      current = {
        ...current,
        revision: 5,
        conflictServerSnapshot: {
          id: "server-1",
          revision: 5,
          type: "meal",
          occurredAt: "2026-07-23T08:00:00.000Z",
          note: "Fresh household edit",
        },
      };
      return true;
    },
    isCurrent: () => true,
    readFreshConflict: () =>
      refreshSerial > serialBefore
        ? {
            local: current,
            serverSnapshot: current.conflictServerSnapshot,
          }
        : null,
  });

  assert.equal(result.status, "resolved");
  if (result.status !== "resolved") return;
  assert.equal(result.entry.note, "Fresh household edit");
  assert.equal(result.entry.revision, 5);
  assert.equal(result.entry.syncStatus, "synced");
  assert.equal(result.entry.conflictServerSnapshot, undefined);
});

test("use-household retains the conflict when the scoped refresh fails", async () => {
  const current = {
    id: "server-1",
    revision: 4,
    note: "My saved edit",
    syncStatus: "conflict" as const,
    conflictServerSnapshot: {
      id: "server-1",
      revision: 4,
      type: "meal",
      occurredAt: "2026-07-23T08:00:00.000Z",
      note: "Displayed household edit",
    },
  };
  let readCount = 0;

  const result = await refreshThenResolveCareEntryConflict({
    refresh: async () => false,
    isCurrent: () => true,
    readFreshConflict: () => {
      readCount += 1;
      return {
        local: current,
        serverSnapshot: current.conflictServerSnapshot,
      };
    },
  });

  assert.equal(result.status, "refresh-failed");
  assert.equal(readCount, 0);
  assert.equal(current.syncStatus, "conflict");
  assert.equal(
    current.conflictServerSnapshot.note,
    "Displayed household edit",
  );
});

test("use-household cannot commit after its captured lifecycle becomes stale", async () => {
  const gate = deferred<boolean>();
  let currentLifecycle = true;
  let readCount = 0;

  const resolving = refreshThenResolveCareEntryConflict({
    refresh: () => gate.promise,
    isCurrent: () => currentLifecycle,
    readFreshConflict: () => {
      readCount += 1;
      return {
        local: {
          id: "server-1",
          revision: 5,
          note: "My saved edit",
          syncStatus: "conflict" as const,
        },
        serverSnapshot: {
          id: "server-1",
          revision: 5,
          type: "meal",
          occurredAt: "2026-07-23T08:00:00.000Z",
          note: "Fresh household edit",
        },
      };
    },
  });
  currentLifecycle = false;
  gate.resolve(true);

  const result = await resolving;
  assert.equal(result.status, "stale");
  assert.equal(readCount, 0);
});

test("refresh makes a divergent newer client-key row conflicted before queue binding", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "temp-1",
        revision: 1,
        note: "Owner edit after the create response was lost",
        details: { clientKey: "temp-1", ownerDraft: true },
        syncStatus: "failed" as const,
        syncError: "Saved locally. Refresh to retry sync.",
      },
    ],
    [
      {
        id: "server-1",
        revision: 3,
        note: "Original create",
        details: { clientKey: "temp-1", householdVisible: true },
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.id, "server-1");
  assert.equal(merged[0]?.revision, 3);
  assert.equal(
    merged[0]?.note,
    "Owner edit after the create response was lost",
  );
  assert.deepEqual(merged[0]?.details, {
    clientKey: "temp-1",
    ownerDraft: true,
  });
  assert.equal(merged[0]?.syncStatus, "conflict");
  assert.match(merged[0]?.syncError ?? "", /household care changed/i);
  assert.equal(shouldRetryUpdate(merged[0]!), false);
});

test("a queued temp edit cannot bind onto a newer divergent client-key revision", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "temp-1",
        revision: 1,
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        note: "Queued temp edit",
        syncStatus: "pending" as const,
      },
    ],
    [
      {
        id: "server-1",
        revision: 2,
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        note: "Newer household edit",
        details: { clientKey: "temp-1" },
        syncStatus: "synced" as const,
      },
    ],
    { hasQueuedMutation: () => true },
  );

  assert.equal(merged[0]?.id, "server-1");
  assert.equal(merged[0]?.revision, 2);
  assert.equal(merged[0]?.note, "Queued temp edit");
  assert.equal(merged[0]?.syncStatus, "conflict");
  assert.equal(
    merged[0]?.conflictServerSnapshot?.note,
    "Newer household edit",
  );
});

test("refresh keeps a base-revision client-key row eligible for one queued patch", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "temp-1",
        revision: 1,
        note: "Owner edit after create",
        details: { clientKey: "temp-1", ownerDraft: true },
        syncStatus: "failed" as const,
        syncError: "Saved locally. Refresh to retry sync.",
      },
    ],
    [
      {
        id: "server-1",
        revision: 1,
        note: "Original create",
        details: { clientKey: "temp-1", householdVisible: true },
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged[0]?.id, "server-1");
  assert.equal(merged[0]?.revision, 1);
  assert.equal(merged[0]?.note, "Owner edit after create");
  assert.equal(merged[0]?.syncStatus, "failed");
  assert.equal(shouldRetryUpdate(merged[0]!), true);
});

test("refresh settles a matching in-flight create when no edit is queued", async () => {
  const local = {
    id: "temp-1",
    revision: 1,
    note: "Original create",
    details: { householdVisible: true },
    syncStatus: "pending" as const,
  };
  const server = {
    id: "server-1",
    revision: 1,
    note: "Original create",
    details: { householdVisible: true, clientKey: "temp-1" },
    syncStatus: "synced" as const,
  };
  const createResponse = deferred<typeof server>();
  let alreadyBound = false;
  let visible = [local];
  const createCompletion = createResponse.promise.then((created) => {
    if (alreadyBound) return;
    visible = [created];
  });

  visible = mergeServerAndLocalEntries(visible, [server], {
    hasQueuedMutation: () => false,
  });
  alreadyBound = true;
  createResponse.resolve(server);
  await createCompletion;

  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, "server-1");
  assert.equal(visible[0]?.revision, 1);
  assert.equal(visible[0]?.syncStatus, "synced");
  assert.equal(visible[0]?.syncError, undefined);
});

test("refresh preserves a matching pending create when a newer edit is queued", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "temp-1",
        revision: 1,
        note: "Newest queued edit",
        details: { householdVisible: true },
        syncStatus: "pending" as const,
      },
    ],
    [
      {
        id: "server-1",
        revision: 1,
        note: "Original create",
        details: { householdVisible: true, clientKey: "temp-1" },
        syncStatus: "synced" as const,
      },
    ],
    { hasQueuedMutation: (key) => key === "temp-1" },
  );

  assert.equal(merged[0]?.id, "server-1");
  assert.equal(merged[0]?.note, "Newest queued edit");
  assert.equal(merged[0]?.syncStatus, "pending");
});

test("queued refresh never promotes the cached local revision across a crash", () => {
  const local = {
    id: "server-1",
    revision: 1,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Queued local B",
    syncStatus: "pending" as const,
  };
  const remote = {
    ...local,
    revision: 2,
    note: "Household R2",
    syncStatus: "synced" as const,
  };
  const duringRefresh = mergeServerAndLocalEntries(
    [local],
    [remote],
    { hasQueuedMutation: () => true },
  );

  assert.equal(duringRefresh[0]?.syncStatus, "pending");
  assert.equal(duringRefresh[0]?.revision, 1);
  assert.equal(duringRefresh[0]?.note, "Queued local B");

  const afterCrash = sanitizeCachedCareEntryConflict(duringRefresh[0]!);
  const rebooted = mergeServerAndLocalEntries(
    [afterCrash],
    [remote],
    {
      hasQueuedMutation: () => false,
      hasLiveCreate: () => false,
    },
  );
  assert.equal(rebooted[0]?.syncStatus, "conflict");
  assert.equal(rebooted[0]?.revision, 2);
  assert.equal(shouldRetryUpdate(rebooted[0]!), false);
});

test("refresh turns a failed edit into conflict instead of rebasing over newer household content", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 1,
        note: "My unsent correction",
        details: { householdVisible: true, ownerDraft: true },
        syncStatus: "failed" as const,
        syncError: "Saved locally. Refresh to retry sync.",
      },
    ],
    [
      {
        id: "server-1",
        revision: 2,
        note: "Another caregiver's correction",
        details: { householdVisible: true, caregiverEdit: true },
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged[0]?.revision, 2);
  assert.equal(merged[0]?.note, "My unsent correction");
  assert.deepEqual(merged[0]?.details, {
    householdVisible: true,
    ownerDraft: true,
  });
  assert.equal(merged[0]?.syncStatus, "conflict");
  assert.match(merged[0]?.syncError ?? "", /household care changed/i);
  assert.equal(shouldRetryUpdate(merged[0]!), false);
  assert.deepEqual(deriveCareSyncOutbox(merged).retryableUpdateIds, []);
});

test("refresh settles a lost PATCH response when newer server content already equals the local edit", () => {
  const local = {
    id: "server-1",
    revision: 1,
    note: "Same persisted edit",
    details: { householdVisible: true },
    syncStatus: "failed" as const,
    syncError: "Saved locally. Refresh to retry sync.",
  };
  const merged = mergeServerAndLocalEntries(
    [local],
    [
      {
        ...local,
        revision: 2,
        syncStatus: "synced" as const,
        syncError: undefined,
      },
    ],
  );

  assert.equal(merged[0]?.revision, 2);
  assert.equal(merged[0]?.syncStatus, "synced");
  assert.equal(merged[0]?.syncError, undefined);
  assert.equal(shouldRetryUpdate(merged[0]!), false);
});

test("refresh keeps an unchanged failed revision explicitly retryable", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 3,
        note: "My retryable edit",
        syncStatus: "failed" as const,
        syncError: "Saved locally. Refresh to retry sync.",
      },
    ],
    [
      {
        id: "server-1",
        revision: 3,
        note: "Persisted base",
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged[0]?.revision, 3);
  assert.equal(merged[0]?.note, "My retryable edit");
  assert.equal(merged[0]?.syncStatus, "failed");
  assert.equal(shouldRetryUpdate(merged[0]!), true);
});

test("restart settles a matching direct pending update with no live queue", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 4,
        note: "Persisted update",
        syncStatus: "pending" as const,
      },
    ],
    [
      {
        id: "server-1",
        revision: 4,
        note: "Persisted update",
        syncStatus: "synced" as const,
      },
    ],
    { hasQueuedMutation: () => false },
  );

  assert.equal(merged[0]?.syncStatus, "synced");
  assert.equal(merged[0]?.revision, 4);
});

test("restart makes a divergent same-revision pending update retryable", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 4,
        note: "Unsaved local update",
        syncStatus: "pending" as const,
      },
    ],
    [
      {
        id: "server-1",
        revision: 4,
        note: "Persisted server base",
        syncStatus: "synced" as const,
      },
    ],
    { hasQueuedMutation: () => false },
  );

  assert.equal(merged[0]?.syncStatus, "failed");
  assert.equal(merged[0]?.note, "Unsaved local update");
  assert.equal(shouldRetryUpdate(merged[0]!), true);
});

test("restart recovers an orphaned pending create without duplicating a live create", () => {
  const local = {
    id: "temp_restart",
    revision: 1,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Breakfast",
    syncStatus: "pending" as const,
  };

  const rebooted = mergeServerAndLocalEntries([local], [], {
    hasQueuedMutation: () => false,
    hasLiveCreate: () => false,
  });
  assert.equal(rebooted[0]?.syncStatus, "failed");
  assert.equal(shouldRetryCreate(rebooted[0]!), true);

  const live = mergeServerAndLocalEntries([local], [], {
    hasQueuedMutation: () => false,
    hasLiveCreate: (key) => key === "temp_restart",
  });
  assert.equal(live[0]?.syncStatus, "pending");
  assert.equal(shouldRetryCreate(live[0]!), true);
});

test("deduped create responses queue one follow-up only when cached temp content diverges", () => {
  const local = {
    id: "temp_restart",
    revision: 1,
    type: "meal",
    title: "Breakfast",
    caregiver: "Alex",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "Original",
    details: { householdVisible: true },
    syncStatus: "pending" as const,
  };
  const returned = {
    ...local,
    id: "server-1",
    caregiverUserId: "server-policy-user",
    details: {
      householdVisible: true,
      clientKey: "temp_restart",
      title: "Breakfast",
      trustState: "pending-confirmation",
      confirmationRequired: true,
      confirmationReason: "safety-critical",
      photoProofStatus: "not-attached",
      photoProofPolicy: "medication-proof",
    },
    syncStatus: "synced" as const,
  };

  assert.equal(
    shouldQueueCareEntryCreateFollowUp(local, returned),
    false,
  );
  const refreshed = mergeServerAndLocalEntries([local], [returned], {
    hasQueuedMutation: () => false,
    hasLiveCreate: () => false,
  });
  assert.equal(refreshed[0]?.id, "server-1");
  assert.equal(refreshed[0]?.syncStatus, "synced");
  assert.equal(
    shouldQueueCareEntryCreateFollowUp(
      { ...local, note: "Edited before restart completed" },
      returned,
    ),
    true,
  );
  assert.equal(
    shouldQueueCareEntryCreateFollowUp(
      {
        ...local,
        details: {
          ...local.details,
          confirmedAt: "2026-07-23T08:01:00.000Z",
          confirmedBy: "owner-1",
        },
      },
      returned,
    ),
    true,
  );
  assert.equal(
    shouldQueueCareEntryCreateFollowUp(
      {
        ...local,
        details: {
          ...local.details,
          photoProofStatus: "attached",
          photoProofAttachmentUri: "file:///proof.jpg",
          photoProofAttachedAt: "2026-07-23T08:02:00.000Z",
        },
      },
      returned,
    ),
    true,
  );
});

test("stale refresh cannot regress an existing conflict revision or server alternative", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 5,
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        note: "My saved edit",
        syncStatus: "conflict" as const,
        syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
        conflictServerSnapshot: {
          id: "server-1",
          revision: 5,
          type: "meal",
          occurredAt: "2026-07-23T08:00:00.000Z",
          note: "Household revision five",
        },
      },
    ],
    [
      {
        id: "server-1",
        revision: 4,
        type: "meal",
        occurredAt: "2026-07-23T08:00:00.000Z",
        note: "Stale household revision four",
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged[0]?.revision, 5);
  assert.equal(merged[0]?.note, "My saved edit");
  assert.equal(merged[0]?.conflictServerSnapshot?.revision, 5);
  assert.equal(
    merged[0]?.conflictServerSnapshot?.note,
    "Household revision five",
  );
});

test("stale full refresh cannot replace a newer locally acknowledged synced row", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 5,
        note: "Queue-acknowledged revision five",
        syncStatus: "synced" as const,
      },
    ],
    [
      {
        id: "server-1",
        revision: 4,
        note: "List snapshot revision four",
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.revision, 5);
  assert.equal(merged[0]?.note, "Queue-acknowledged revision five");
  assert.equal(merged[0]?.syncStatus, "synced");
});

test("late mutation callbacks cannot regress a newer household revision observed by refresh", () => {
  const refreshedConflict = {
    id: "server-1",
    revision: 6,
    type: "meal",
    occurredAt: "2026-07-23T08:00:00.000Z",
    note: "My saved edit",
    syncStatus: "conflict" as const,
    syncError: CARE_ENTRY_REVISION_CONFLICT_MESSAGE,
    conflictServerSnapshot: {
      id: "server-1",
      revision: 6,
      type: "meal",
      occurredAt: "2026-07-23T08:00:00.000Z",
      note: "Household revision six",
    },
  };
  const lateSynced = {
    ...refreshedConflict,
    revision: 5,
    note: "PATCH response revision five",
    syncStatus: "synced" as const,
    syncError: undefined,
    conflictServerSnapshot: undefined,
  };
  const lateConflict = {
    ...refreshedConflict,
    revision: 5,
    note: "Late conflict revision five",
    conflictServerSnapshot: {
      ...refreshedConflict.conflictServerSnapshot,
      revision: 5,
      note: "Household revision five",
    },
  };
  const lateFailure = {
    ...refreshedConflict,
    revision: 4,
    note: "Late failed optimistic revision four",
    syncStatus: "failed" as const,
    syncError: "Saved locally. Refresh to retry sync.",
    conflictServerSnapshot: undefined,
  };

  assert.equal(
    applyCareEntryMutationCallback(refreshedConflict, lateSynced, 5),
    refreshedConflict,
  );
  assert.equal(
    applyCareEntryMutationCallback(refreshedConflict, lateConflict, 5),
    refreshedConflict,
  );
  assert.equal(
    applyCareEntryMutationCallback(refreshedConflict, lateFailure, 4),
    refreshedConflict,
  );

  const pendingRevisionFour = {
    ...refreshedConflict,
    revision: 4,
    syncStatus: "pending" as const,
    conflictServerSnapshot: undefined,
  };
  assert.equal(
    applyCareEntryMutationCallback(pendingRevisionFour, lateSynced, 5),
    lateSynced,
  );
});

test("refresh keeps a queued follow-up failure retryable at its advanced base revision", () => {
  const merged = mergeServerAndLocalEntries(
    [
      {
        id: "server-1",
        revision: 2,
        note: "B",
        mood: "happy",
        syncStatus: "failed" as const,
        syncError: "Saved locally. Refresh to retry sync.",
      },
    ],
    [
      {
        id: "server-1",
        revision: 2,
        note: "A",
        syncStatus: "synced" as const,
      },
    ],
  );

  assert.equal(merged[0]?.revision, 2);
  assert.equal(merged[0]?.note, "B");
  assert.equal(merged[0]?.syncStatus, "failed");
  assert.equal(shouldRetryUpdate(merged[0]!), true);
});

test("entry conflicts stay visible in the outbox but are excluded from automatic retry", () => {
  const conflict = {
    id: "server-conflict",
    title: "Breakfast",
    occurredAt: "2026-07-23T08:00:00.000Z",
    revision: 3,
    syncStatus: "conflict" as const,
    syncError:
      "Household care changed before this edit synced. Review your saved version.",
  };

  assert.equal(isUnsyncedEntry(conflict), true);
  assert.equal(shouldRetryUpdate(conflict), false);

  const outbox = deriveCareSyncOutbox([conflict]);
  assert.equal(outbox.total, 1);
  assert.equal(outbox.conflicted, 1);
  assert.equal(outbox.retryable, 0);
  assert.deepEqual(outbox.retryableUpdateIds, []);
  assert.equal(outbox.status, "needs-retry");
  assert.match(outbox.message, /conflict/i);
  assert.equal(outbox.actionLabel, "Review conflict");

  const dashboard = deriveCareSyncDashboard({
    outbox,
    isLoaded: true,
    isSyncing: false,
    householdMemberCount: 2,
    totalEntries: 1,
  });
  assert.equal(dashboard.status, "attention");
  assert.match(dashboard.title, /conflict/i);
  assert.match(dashboard.nextStep, /review/i);
});

test("ordinary care-entry updates cannot bypass explicit conflict resolution", () => {
  assert.equal(
    canApplyCareEntryUpdate({
      id: "server-conflict",
      revision: 4,
      syncStatus: "conflict",
    }),
    false,
  );
  assert.equal(
    canApplyCareEntryUpdate({
      id: "server-failed",
      revision: 4,
      syncStatus: "failed",
    }),
    true,
  );
});
