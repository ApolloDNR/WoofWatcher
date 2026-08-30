import assert from "node:assert/strict";
import test from "node:test";

import {
  CareEntryConflictRetryError,
  createSerializedCareEntryMutationQueue,
  isCareEntryMutationNotFound,
  mergeServerAndLocalEntries,
  partitionCachedCareEntriesByDiscardedIdentity,
  shouldRetryCreate,
  shouldRetryUpdate,
} from "./careSync.ts";
import {
  applyExactCareEntryCreateRevocation,
  applyExactCareEntryNotFoundRevocation,
  persistCareEntryRevocationSuppression,
  releaseCareEntryRevocationSuppression,
} from "./careEntryMutationRevocation.ts";
import {
  createCareIdentityVault,
  readCareIdentitySlot,
  serializeCareIdentityVault,
  writeCareIdentitySlot,
} from "./careIdentityStorage.ts";
import { ApiError } from "../../../lib/api-client-react/src/custom-fetch.ts";

type TestEntry = {
  id: string;
  syncStatus?: "local" | "pending" | "synced" | "failed";
  pendingSyncPatch?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

const revocationPersistenceCombinations = [
  { cleanupLedger: true, identitySlot: true },
  { cleanupLedger: true, identitySlot: false },
  { cleanupLedger: false, identitySlot: true },
  { cleanupLedger: false, identitySlot: false },
] as const;

async function runShippingRevocationPersistenceCombination(input: {
  kind: "create" | "patch";
  cleanupLedger: boolean;
  identitySlot: boolean;
}) {
  const revoked: TestEntry =
    input.kind === "create"
      ? {
          id: "temp_terminal_revocation",
          syncStatus: "failed",
          details: { clientKey: "temp_terminal_revocation" },
        }
      : {
          id: "server_terminal_revocation",
          syncStatus: "failed",
          pendingSyncPatch: { note: "must not retry" },
        };
  const safe: TestEntry = { id: "server_safe", syncStatus: "synced" };
  let activeEntries = [revoked, safe];
  let persistedIdentitySlot = [...activeEntries];
  let persistedCleanupLedger: string[] = [];
  const persistenceAttempts: string[] = [];
  let persistenceFailureReported = false;

  const persistActiveSlot = () =>
    persistCareEntryRevocationSuppression({
      async persistCleanupLedger() {
        persistenceAttempts.push("cleanup-ledger");
        if (!input.cleanupLedger) {
          throw new Error("cleanup ledger unavailable");
        }
        persistedCleanupLedger = [revoked.id];
        return true;
      },
      async persistIdentitySlot() {
        persistenceAttempts.push("identity-slot");
        if (!input.identitySlot) return false;
        persistedIdentitySlot = [...activeEntries];
        return true;
      },
    });

  const result =
    input.kind === "create"
      ? await applyExactCareEntryCreateRevocation({
          tempId: revoked.id,
          error: {
            status: 410,
            data: {
              code: "care_entry_create_revoked",
              clientKey: revoked.id,
            },
          },
          canContinue: () => true,
          isCurrentAttempt: () => true,
          readEntries: () => activeEntries,
          clearCreateState() {},
          replaceActiveSlot(retained) {
            activeEntries = [...retained];
          },
          publishEntries(retained) {
            activeEntries = [...retained];
          },
          persistActiveSlot,
          onPersistenceFailure() {
            persistenceFailureReported = true;
          },
        })
      : await applyExactCareEntryNotFoundRevocation({
          entryId: revoked.id,
          submittedEntry: revoked,
          error: { status: 404 },
          isNotFoundError: isCareEntryMutationNotFound,
          canContinue: () => true,
          readEntries: () => activeEntries,
          cancelMutation() {},
          clearMutationAuthority() {},
          replaceActiveSlot(retained) {
            activeEntries = [...retained];
          },
          publishEntries(retained) {
            activeEntries = [...retained];
          },
          persistActiveSlot,
          onPersistenceFailure() {
            persistenceFailureReported = true;
          },
        });

  return {
    activeEntries,
    hydratedEntries: partitionCachedCareEntriesByDiscardedIdentity(
      persistedIdentitySlot,
      persistedCleanupLedger,
    ).retained,
    persistenceAttempts,
    persistenceFailureReported,
    result,
    revoked,
    safe,
  };
}

async function runRevocation(input: {
  entry: TestEntry;
  currentEntry?: TestEntry;
  error?: unknown;
  current?: boolean;
}) {
  let activeEntries: TestEntry[] = [
    input.currentEntry ?? input.entry,
    { id: "server-visible", syncStatus: "synced" },
    {
      id: "temp-never-visible",
      syncStatus: "failed",
      details: { clientKey: "temp-never-visible" },
    },
  ];
  const quarantine: TestEntry[] = [];
  const actions: string[] = [];
  const cleared: Array<[string, TestEntry]> = [];

  const result = await applyExactCareEntryNotFoundRevocation({
    entryId: input.entry.id,
    submittedEntry: input.entry,
    error: input.error ?? { status: 404 },
    isNotFoundError: isCareEntryMutationNotFound,
    canContinue: () => input.current ?? true,
    readEntries: () => activeEntries,
    cancelMutation(entryId) {
      actions.push(`cancel:${entryId}`);
    },
    clearMutationAuthority(entryId, entry) {
      actions.push(`clear:${entryId}`);
      cleared.push([entryId, entry]);
    },
    replaceActiveSlot(retained, revoked) {
      actions.push("active-slot");
      activeEntries = [...retained];
      quarantine.push(revoked);
    },
    publishEntries(retained) {
      actions.push("publish");
      activeEntries = [...retained];
    },
    async persistActiveSlot() {
      actions.push("persist");
      return true;
    },
    onPersistenceFailure() {
      assert.fail("the default revocation persistence succeeds");
    },
  });

  return { actions, activeEntries, cleared, quarantine, result };
}

for (const kind of ["create", "patch"] as const) {
  for (const persistence of revocationPersistenceCombinations) {
    const label = [
      persistence.cleanupLedger
        ? "cleanup ledger succeeds"
        : "cleanup ledger fails",
      persistence.identitySlot
        ? "identity slot succeeds"
        : "identity slot fails",
    ].join(", ");

    test(`${kind.toUpperCase()} terminal revocation attempts both durable paths when ${label}`, async () => {
      const outcome = await runShippingRevocationPersistenceCombination({
        kind,
        ...persistence,
      });
      const isDurable = persistence.cleanupLedger || persistence.identitySlot;

      assert.deepEqual(outcome.persistenceAttempts, [
        "cleanup-ledger",
        "identity-slot",
      ]);
      assert.equal(
        outcome.result.status,
        isDurable ? "revoked" : "persistence-failed",
      );
      assert.equal(outcome.persistenceFailureReported, !isDurable);
      assert.deepEqual(outcome.activeEntries, [outcome.safe]);
      assert.deepEqual(
        kind === "create"
          ? outcome.activeEntries.filter(shouldRetryCreate)
          : outcome.activeEntries.filter(shouldRetryUpdate),
        [],
        "terminal revocation must stay non-renderable and non-retryable in the current session",
      );

      if (isDurable) {
        assert.deepEqual(
          outcome.hydratedEntries,
          [outcome.safe],
          "the shipping hydration partition must suppress the revoked row when either durable path succeeds",
        );
      } else {
        assert.deepEqual(
          outcome.hydratedEntries,
          [outcome.revoked, outcome.safe],
          "when both device writes fail, relaunch suppression is unproven and the current session must report fail-closed storage state",
        );
      }
    });
  }
}

test("one failed suppression write cannot settle before the other durable path finishes", async () => {
  let resolveIdentitySlot!: (persisted: boolean) => void;
  const identitySlot = new Promise<boolean>((resolve) => {
    resolveIdentitySlot = resolve;
  });
  let settled = false;
  const persistence = persistCareEntryRevocationSuppression({
    async persistCleanupLedger() {
      throw new Error("cleanup ledger unavailable");
    },
    persistIdentitySlot: () => identitySlot,
  }).finally(() => {
    settled = true;
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false);

  resolveIdentitySlot(true);
  assert.equal(await persistence, true);
  assert.equal(settled, true);
});

for (const phase of ["initial sync", "already-mounted refresh"] as const) {
  test(`PATCH ledger-only suppression stays pinned through ${phase} until the merged clean slot persists`, async () => {
    const revoked: TestEntry = {
      id: "server_patch_ledger_fallback",
      syncStatus: "failed",
      pendingSyncPatch: { note: "must never retry" },
    };
    const safe: TestEntry = { id: "server_safe", syncStatus: "synced" };
    const mergedCleanEntries = [safe];
    let persistedIdentitySlot = [revoked, safe];
    let persistedCleanupLedger = [revoked.id];
    let cleanupCalls = 0;

    const retainedFallback = await releaseCareEntryRevocationSuppression({
      async persistIdentitySlot() {
        return false;
      },
      async clearCleanupLedger() {
        cleanupCalls += 1;
        persistedCleanupLedger = [];
      },
    });

    assert.equal(retainedFallback, false);
    assert.equal(cleanupCalls, 0);
    assert.deepEqual(persistedCleanupLedger, [revoked.id]);
    assert.deepEqual(
      partitionCachedCareEntriesByDiscardedIdentity(
        persistedIdentitySlot,
        persistedCleanupLedger,
      ).retained,
      mergedCleanEntries,
      "a crash after another failed primary write must still hydrate through the pinned ledger",
    );

    const releasedFallback = await releaseCareEntryRevocationSuppression({
      async persistIdentitySlot() {
        persistedIdentitySlot = [...mergedCleanEntries];
        return true;
      },
      async clearCleanupLedger() {
        cleanupCalls += 1;
        persistedCleanupLedger = [];
      },
    });

    assert.equal(releasedFallback, true);
    assert.equal(cleanupCalls, 1);
    assert.deepEqual(persistedCleanupLedger, []);
    assert.deepEqual(
      partitionCachedCareEntriesByDiscardedIdentity(
        persistedIdentitySlot,
        persistedCleanupLedger,
      ).retained,
      mergedCleanEntries,
      "after the merged clean slot is durable, clearing the fallback remains relaunch-safe",
    );
  });
}

test("a failed cleanup-ledger release stays durable and retryable after the clean slot persists", async () => {
  const revokedId = "server_release_retry";
  let persistedCleanupLedger = [revokedId];
  let clearAttempts = 0;

  const firstRelease = await releaseCareEntryRevocationSuppression({
    async persistIdentitySlot() {
      return true;
    },
    async clearCleanupLedger() {
      clearAttempts += 1;
      persistedCleanupLedger = [];
      persistedCleanupLedger = [revokedId];
      throw new Error("cleanup ledger unavailable");
    },
  });

  assert.equal(firstRelease, false);
  assert.deepEqual(persistedCleanupLedger, [revokedId]);

  const retryRelease = await releaseCareEntryRevocationSuppression({
    async persistIdentitySlot() {
      return true;
    },
    async clearCleanupLedger() {
      clearAttempts += 1;
      persistedCleanupLedger = [];
    },
  });

  assert.equal(retryRelease, true);
  assert.equal(clearAttempts, 2);
  assert.deepEqual(persistedCleanupLedger, []);
});

for (const syncStatus of ["pending", "failed"] as const) {
  test(`exact current PATCH 404 revokes a ${syncStatus} durable edit before it can retry`, async () => {
    const revoked: TestEntry = {
      id: "server-now-private-or-deleted",
      syncStatus,
      pendingSyncPatch: { note: "A stale household edit" },
    };
    const outcome = await runRevocation({ entry: revoked });

    assert.equal(outcome.result.status, "revoked");
    assert.deepEqual(outcome.quarantine, [revoked]);
    assert.deepEqual(
      outcome.activeEntries.map((entry) => entry.id),
      ["server-visible", "temp-never-visible"],
    );
    assert.deepEqual(outcome.cleared, [[revoked.id, revoked]]);
    assert.deepEqual(outcome.actions, [
      "active-slot",
      "persist",
      `cancel:${revoked.id}`,
      `clear:${revoked.id}`,
      "publish",
    ]);
    assert.deepEqual(
      outcome.activeEntries.filter(shouldRetryUpdate),
      [],
      "the revoked durable id must not reach the next PATCH retry derivation",
    );
  });
}

test("a stale-identity 404 cannot purge or quarantine the replacement identity", async () => {
  const entry: TestEntry = {
    id: "server-a",
    syncStatus: "pending",
    pendingSyncPatch: { note: "A only" },
  };
  const outcome = await runRevocation({ entry, current: false });

  assert.equal(outcome.result.status, "ignored-stale");
  assert.deepEqual(outcome.actions, []);
  assert.deepEqual(outcome.quarantine, []);
  assert.equal(outcome.activeEntries[0], entry);
});

test("non-404 failures remain retryable and never masquerade as privacy revocation", async () => {
  const entry: TestEntry = {
    id: "server-offline",
    syncStatus: "failed",
    pendingSyncPatch: { note: "Retry later" },
  };
  const outcome = await runRevocation({ entry, error: { status: 503 } });

  assert.equal(outcome.result.status, "not-revoked");
  assert.deepEqual(outcome.actions, []);
  assert.equal(shouldRetryUpdate(outcome.activeEntries[0]!), true);
});

test("a conflict retry whose exact rebased PATCH returns 404 is still revocation", async () => {
  const entry: TestEntry = {
    id: "server-privatized-during-rebase",
    syncStatus: "pending",
    pendingSyncPatch: { note: "Rebased stale edit" },
  };
  const outcome = await runRevocation({
    entry,
    error: new CareEntryConflictRetryError(entry, { status: 404 }),
  });

  assert.equal(outcome.result.status, "revoked");
  assert.deepEqual(outcome.quarantine, [entry]);
  assert.equal(
    outcome.activeEntries.some((candidate) => candidate.id === entry.id),
    false,
  );
});

test("an old generation's 404 cannot revoke a newer same-id local snapshot", async () => {
  const oldEntry: TestEntry = {
    id: "server-same-id",
    syncStatus: "pending",
    pendingSyncPatch: { note: "Old generation" },
  };
  const newerEntry: TestEntry = {
    ...oldEntry,
    pendingSyncPatch: { note: "New generation" },
  };
  const outcome = await runRevocation({
    entry: oldEntry,
    currentEntry: newerEntry,
  });

  assert.equal(outcome.result.status, "ignored-stale");
  assert.deepEqual(outcome.actions, []);
  assert.deepEqual(outcome.quarantine, []);
  assert.equal(outcome.activeEntries[0], newerEntry);
});

test("the serialized queue suppresses an old 404 before the revocation callback sees a newer generation", async () => {
  let rejectOld!: (error: unknown) => void;
  let resolveNew!: (value: string) => void;
  const oldResult = new Promise<string>((_resolve, reject) => {
    rejectOld = reject;
  });
  const newResult = new Promise<string>((resolve) => {
    resolveNew = resolve;
  });
  const oldEntry: TestEntry = {
    id: "server-queued",
    syncStatus: "pending",
    pendingSyncPatch: { note: "Old" },
  };
  const newEntry: TestEntry = {
    ...oldEntry,
    pendingSyncPatch: { note: "New" },
  };
  let activeEntries = [oldEntry];
  const quarantined: TestEntry[] = [];
  const failures: TestEntry[] = [];
  let call = 0;

  const queue = createSerializedCareEntryMutationQueue<TestEntry, string>({
    mutate: () => (call++ === 0 ? oldResult : newResult),
    onSuccess() {},
    async onFailure(entryId, submittedEntry, error) {
      failures.push(submittedEntry);
      await applyExactCareEntryNotFoundRevocation({
        entryId,
        submittedEntry,
        error,
        isNotFoundError: isCareEntryMutationNotFound,
        canContinue: () => true,
        readEntries: () => activeEntries,
        cancelMutation: (id) => queue.cancel(id),
        clearMutationAuthority() {},
        replaceActiveSlot(retained, revoked) {
          activeEntries = retained;
          quarantined.push(revoked);
        },
        publishEntries: (retained) => {
          activeEntries = retained;
        },
        async persistActiveSlot() {
          return true;
        },
        onPersistenceFailure() {
          assert.fail("queue revocation persistence succeeds");
        },
      });
    },
  });

  queue.enqueue(oldEntry.id, oldEntry);
  activeEntries = [newEntry];
  queue.enqueue(newEntry.id, newEntry);
  rejectOld({ status: 404 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  resolveNew("saved");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(failures, []);
  assert.deepEqual(quarantined, []);
  assert.equal(activeEntries[0], newEntry);
});

test("a never-acknowledged temporary create is not revoked by list absence or a 404-shaped error", async () => {
  const entry: TestEntry = {
    id: "temp_local_create",
    syncStatus: "failed",
    details: { clientKey: "temp_local_create" },
  };
  const outcome = await runRevocation({ entry });

  assert.equal(outcome.result.status, "not-revoked");
  assert.deepEqual(outcome.actions, []);
  assert.equal(outcome.activeEntries[0], entry);
});

test("absence from the capped care-entry list is never treated as durable-row revocation", () => {
  const local: TestEntry = {
    id: "server-older-than-page",
    syncStatus: "failed",
    pendingSyncPatch: { note: "Still needs an exact PATCH result" },
  };

  assert.deepEqual(mergeServerAndLocalEntries([local], []), [local]);
});

test("revocation rewrites the exact active identity slot and persists non-renderable recovery evidence", async () => {
  const dataScope = 'care-v2:["user-a","household-a"]';
  const revoked: TestEntry = {
    id: "server-private",
    syncStatus: "failed",
    pendingSyncPatch: { note: "Must not retry" },
  };
  const shared: TestEntry = { id: "server-shared", syncStatus: "synced" };
  let activeEntries = [revoked, shared];
  const vault = createCareIdentityVault();
  const doc = { updatedAt: "2026-08-29T00:00:00.000Z" };
  writeCareIdentitySlot(vault, dataScope, {
    doc,
    entries: activeEntries,
    serverVersion: 7,
  });
  let persisted = "";

  const result = await applyExactCareEntryNotFoundRevocation({
    entryId: revoked.id,
    submittedEntry: revoked,
    error: { status: 404 },
    isNotFoundError: isCareEntryMutationNotFound,
    canContinue: () => true,
    readEntries: () => activeEntries,
    cancelMutation() {},
    clearMutationAuthority() {},
    replaceActiveSlot(retained, privateEvidence) {
      activeEntries = retained;
      vault.quarantine.push({
        reason: "Exact PATCH 404 revocation",
        snapshot: { dataScope, entry: privateEvidence },
      });
      writeCareIdentitySlot(vault, dataScope, {
        doc,
        entries: retained,
        serverVersion: 7,
      });
    },
    publishEntries: (retained) => {
      activeEntries = retained;
    },
    persistActiveSlot: async () => {
      persisted = serializeCareIdentityVault(vault);
      return true;
    },
    onPersistenceFailure() {
      assert.fail("identity-slot persistence succeeds");
    },
  });

  assert.equal(result.status, "revoked");
  const restored = JSON.parse(persisted) as typeof vault;
  assert.deepEqual(
    readCareIdentitySlot<{ entries: TestEntry[] }>(restored, dataScope)
      ?.entries,
    [shared],
  );
  assert.deepEqual(restored.quarantine, [
    {
      reason: "Exact PATCH 404 revocation",
      snapshot: { dataScope, entry: revoked },
    },
  ]);
});

test("PATCH 404 relaunch suppression is durable before revocation settles or publishes", async () => {
  const revoked: TestEntry = {
    id: "server_patch_deleted",
    syncStatus: "failed",
    pendingSyncPatch: { note: "stale edit" },
  };
  const safe: TestEntry = { id: "server_patch_safe", syncStatus: "synced" };
  let activeEntries = [revoked, safe];
  let persistedSlot = [revoked, safe];
  const durableDiscarded = new Set<string>();
  let published = false;
  let releaseSlotWrite = () => {};
  const slotWriteGate = new Promise<void>((resolve) => {
    releaseSlotWrite = resolve;
  });
  let markPersistenceEntered = () => {};
  const persistenceEntered = new Promise<void>((resolve) => {
    markPersistenceEntered = resolve;
  });

  const settlement = applyExactCareEntryNotFoundRevocation({
    entryId: revoked.id,
    submittedEntry: revoked,
    error: { status: 404 },
    isNotFoundError: isCareEntryMutationNotFound,
    canContinue: () => true,
    readEntries: () => activeEntries,
    cancelMutation() {},
    clearMutationAuthority() {},
    replaceActiveSlot(retained) {
      activeEntries = [...retained];
    },
    publishEntries(retained) {
      published = true;
      activeEntries = [...retained];
    },
    async persistActiveSlot() {
      durableDiscarded.add(revoked.id);
      markPersistenceEntered();
      await slotWriteGate;
      persistedSlot = [...activeEntries];
      return true;
    },
    onPersistenceFailure() {
      assert.fail("deferred PATCH persistence succeeds");
    },
  });

  await persistenceEntered;
  assert.equal(published, false);
  assert.deepEqual(
    partitionCachedCareEntriesByDiscardedIdentity(persistedSlot, [
      ...durableDiscarded,
    ]).retained,
    [safe],
    "a reboot during the identity-slot write must suppress the revoked row",
  );
  releaseSlotWrite();
  assert.equal((await settlement).status, "revoked");
  assert.equal(published, true);
  assert.deepEqual(persistedSlot, [safe]);
  assert.deepEqual(activeEntries.filter(shouldRetryUpdate), []);
});

test("a failed PATCH revocation slot write remains fail-closed and never retries", async () => {
  const revoked: TestEntry = {
    id: "server_patch_storage_failed",
    syncStatus: "failed",
    pendingSyncPatch: { note: "must not retry" },
  };
  let activeEntries = [revoked];
  let failedClosed = false;
  const result = await applyExactCareEntryNotFoundRevocation({
    entryId: revoked.id,
    submittedEntry: revoked,
    error: { status: 404 },
    isNotFoundError: isCareEntryMutationNotFound,
    canContinue: () => true,
    readEntries: () => activeEntries,
    cancelMutation() {},
    clearMutationAuthority() {},
    replaceActiveSlot(retained) {
      activeEntries = [...retained];
    },
    publishEntries(retained) {
      activeEntries = [...retained];
    },
    async persistActiveSlot() {
      return false;
    },
    onPersistenceFailure() {
      failedClosed = true;
    },
  });

  assert.equal(result.status, "persistence-failed");
  assert.equal(failedClosed, true);
  assert.deepEqual(activeEntries, []);
  assert.deepEqual(activeEntries.filter(shouldRetryUpdate), []);
});

test("an exact terminal CREATE revocation durably purges and quarantines the temp row before any retry", async () => {
  const revoked: TestEntry = {
    id: "temp_deleted_on_other_device",
    syncStatus: "failed",
    details: { clientKey: "temp_deleted_on_other_device" },
  };
  const retained: TestEntry = {
    id: "temp_still_retryable",
    syncStatus: "failed",
  };
  let activeEntries = [revoked, retained];
  const quarantine: TestEntry[] = [];
  const actions: string[] = [];

  const result = await applyExactCareEntryCreateRevocation({
    tempId: revoked.id,
    error: {
      status: 410,
      data: {
        error: "This care entry was deleted and cannot be recreated.",
        code: "care_entry_create_revoked",
        clientKey: revoked.id,
      },
    },
    canContinue: () => true,
    isCurrentAttempt: () => true,
    readEntries: () => activeEntries,
    clearCreateState(tempId, entry) {
      actions.push(`clear:${tempId}`);
      assert.equal(entry, revoked);
    },
    replaceActiveSlot(next, entry) {
      actions.push("active-slot");
      activeEntries = [...next];
      quarantine.push(entry);
    },
    publishEntries(next) {
      actions.push("publish");
      activeEntries = [...next];
    },
    async persistActiveSlot() {
      actions.push("persist");
      return true;
    },
    onPersistenceFailure() {
      assert.fail("successful persistence must not fail closed");
    },
  });

  assert.equal(result.status, "revoked");
  assert.deepEqual(quarantine, [revoked]);
  assert.deepEqual(activeEntries, [retained]);
  assert.deepEqual(actions, [
    "active-slot",
    "persist",
    `clear:${revoked.id}`,
    "publish",
  ]);
  assert.deepEqual(
    activeEntries.filter(shouldRetryCreate),
    [retained],
    "the deleted temp identity must never reach another CREATE retry",
  );
});

test("CREATE revocation accepts the shipping ApiError only by exact status, code, normalized client key, permit, and attempt", async () => {
  const entry: TestEntry = {
    id: "temp_exact",
    syncStatus: "failed",
  };
  const scenarios = [
    { status: 409, code: "care_entry_create_revoked", clientKey: entry.id },
    { status: 410, code: "not_the_terminal_code", clientKey: entry.id },
    {
      status: 410,
      code: "care_entry_create_revoked",
      clientKey: "temp_different",
    },
  ];

  for (const scenario of scenarios) {
    let activeEntries = [entry];
    let mutated = false;
    const result = await applyExactCareEntryCreateRevocation({
      tempId: entry.id,
      error: { status: scenario.status, data: scenario },
      canContinue: () => true,
      isCurrentAttempt: () => true,
      readEntries: () => activeEntries,
      clearCreateState() {
        mutated = true;
      },
      replaceActiveSlot(next) {
        mutated = true;
        activeEntries = [...next];
      },
      publishEntries() {
        mutated = true;
      },
      async persistActiveSlot() {
        mutated = true;
        return true;
      },
      onPersistenceFailure() {
        mutated = true;
      },
    });
    assert.equal(result.status, "not-revoked");
    assert.equal(mutated, false);
    assert.deepEqual(activeEntries, [entry]);
  }

  const stale = await applyExactCareEntryCreateRevocation({
    tempId: entry.id,
    error: {
      status: 410,
      data: {
        code: "care_entry_create_revoked",
        clientKey: entry.id,
      },
    },
    canContinue: () => false,
    isCurrentAttempt: () => true,
    readEntries: () => [entry],
    clearCreateState() {
      assert.fail("stale identity must not mutate");
    },
    replaceActiveSlot() {
      assert.fail("stale identity must not mutate");
    },
    publishEntries() {
      assert.fail("stale identity must not mutate");
    },
    async persistActiveSlot() {
      assert.fail("stale identity must not mutate");
      return false;
    },
    onPersistenceFailure() {
      assert.fail("stale identity must not mutate");
    },
  });
  assert.equal(stale.status, "ignored-stale");

  const data = {
    error: "This care entry was deleted and cannot be recreated.",
    code: "care_entry_create_revoked",
    clientKey: entry.id,
  };
  const shippingError = new ApiError(
    new Response(JSON.stringify(data), {
      status: 410,
      statusText: "Gone",
      headers: { "content-type": "application/json" },
    }),
    data,
    { method: "POST", url: "/api/care-entries" },
  );
  let activeEntries = [entry];
  const shippingResult = await applyExactCareEntryCreateRevocation({
    tempId: entry.id,
    error: shippingError,
    canContinue: () => true,
    isCurrentAttempt: () => true,
    readEntries: () => activeEntries,
    clearCreateState() {},
    replaceActiveSlot(next) {
      activeEntries = [...next];
    },
    publishEntries(next) {
      activeEntries = [...next];
    },
    async persistActiveSlot() {
      return true;
    },
    onPersistenceFailure() {
      assert.fail("shipping ApiError should persist");
    },
  });
  assert.equal(shippingResult.status, "revoked");
  assert.deepEqual(activeEntries, []);
});

test("an edit during the same CREATE attempt is still purged by exact deletion authority", async () => {
  const submitted: TestEntry = {
    id: "temp_same_id_new_generation",
    syncStatus: "pending",
    details: { note: "old" },
  };
  const newer: TestEntry = {
    ...submitted,
    details: { note: "newer local edit" },
  };
  let activeEntries = [newer];
  let mutated = false;

  const result = await applyExactCareEntryCreateRevocation({
    tempId: submitted.id,
    error: {
      status: 410,
      data: {
        code: "care_entry_create_revoked",
        clientKey: submitted.id,
      },
    },
    canContinue: () => true,
    isCurrentAttempt: () => true,
    readEntries: () => activeEntries,
    clearCreateState() {
      mutated = true;
    },
    replaceActiveSlot(next) {
      mutated = true;
      activeEntries = [...next];
    },
    publishEntries() {
      mutated = true;
    },
    async persistActiveSlot() {
      return true;
    },
    onPersistenceFailure() {
      assert.fail("the same attempt should persist");
    },
  });

  assert.equal(result.status, "revoked");
  assert.equal(mutated, true);
  assert.deepEqual(activeEntries, []);
});

test("an older CREATE attempt's 410 cannot purge a newer same-key attempt", async () => {
  const entry: TestEntry = {
    id: "temp_newer_attempt",
    syncStatus: "pending",
  };
  const attemptTokens = new Map<string, object>();
  const attemptA = {};
  const attemptB = {};
  attemptTokens.set(entry.id, attemptA);
  attemptTokens.set(entry.id, attemptB);
  const attemptAIsCurrent = () => attemptTokens.get(entry.id) === attemptA;
  let mutated = false;
  const result = await applyExactCareEntryCreateRevocation({
    tempId: entry.id,
    error: {
      status: 410,
      data: {
        code: "care_entry_create_revoked",
        clientKey: entry.id,
      },
    },
    canContinue: () => true,
    isCurrentAttempt: attemptAIsCurrent,
    readEntries: () => [entry],
    clearCreateState() {
      mutated = true;
    },
    replaceActiveSlot() {
      mutated = true;
    },
    publishEntries() {
      mutated = true;
    },
    async persistActiveSlot() {
      mutated = true;
      return true;
    },
    onPersistenceFailure() {
      mutated = true;
    },
  });
  if (attemptAIsCurrent()) attemptTokens.delete(entry.id);
  assert.equal(result.status, "ignored-stale");
  assert.equal(mutated, false);
  assert.equal(
    attemptTokens.get(entry.id),
    attemptB,
    "attempt A's finalizer must not clear attempt B's opaque token",
  );
});

test("deferred durable purge writes relaunch suppression before it settles or publishes", async () => {
  const revoked: TestEntry = {
    id: "temp_deferred_durable_purge",
    syncStatus: "failed",
  };
  const safe: TestEntry = { id: "server_safe", syncStatus: "synced" };
  let activeEntries = [revoked, safe];
  let persistedSlot = [revoked, safe];
  const durableDiscarded = new Set<string>();
  let published = false;
  let releaseSlotWrite = () => {};
  const slotWriteGate = new Promise<void>((resolve) => {
    releaseSlotWrite = resolve;
  });
  let markPersistenceEntered = () => {};
  const persistenceEntered = new Promise<void>((resolve) => {
    markPersistenceEntered = resolve;
  });

  const settlement = applyExactCareEntryCreateRevocation({
    tempId: revoked.id,
    error: {
      status: 410,
      data: {
        code: "care_entry_create_revoked",
        clientKey: revoked.id,
      },
    },
    canContinue: () => true,
    isCurrentAttempt: () => true,
    readEntries: () => activeEntries,
    clearCreateState() {},
    replaceActiveSlot(next) {
      activeEntries = [...next];
    },
    publishEntries(next) {
      published = true;
      activeEntries = [...next];
    },
    async persistActiveSlot() {
      durableDiscarded.add(revoked.id);
      markPersistenceEntered();
      await slotWriteGate;
      persistedSlot = [...activeEntries];
      return true;
    },
    onPersistenceFailure() {
      assert.fail("deferred persistence succeeds");
    },
  });

  await persistenceEntered;
  assert.equal(published, false);
  assert.deepEqual(
    partitionCachedCareEntriesByDiscardedIdentity(persistedSlot, [
      ...durableDiscarded,
    ]).retained,
    [safe],
    "a relaunch during the slot-write gap must suppress the revoked temp row",
  );
  releaseSlotWrite();
  assert.equal((await settlement).status, "revoked");
  assert.equal(published, true);
  assert.deepEqual(persistedSlot, [safe]);
  assert.deepEqual(activeEntries.filter(shouldRetryCreate), []);
});

test("a failed active-slot write stays non-renderable, reports fail-closed storage state, and never retries", async () => {
  const revoked: TestEntry = {
    id: "temp_failed_durable_purge",
    syncStatus: "failed",
  };
  let activeEntries = [revoked];
  let failedClosed = false;
  const result = await applyExactCareEntryCreateRevocation({
    tempId: revoked.id,
    error: {
      status: 410,
      data: {
        code: "care_entry_create_revoked",
        clientKey: revoked.id,
      },
    },
    canContinue: () => true,
    isCurrentAttempt: () => true,
    readEntries: () => activeEntries,
    clearCreateState() {},
    replaceActiveSlot(next) {
      activeEntries = [...next];
    },
    publishEntries(next) {
      activeEntries = [...next];
    },
    async persistActiveSlot() {
      return false;
    },
    onPersistenceFailure() {
      failedClosed = true;
    },
  });

  assert.equal(result.status, "persistence-failed");
  assert.equal(failedClosed, true);
  assert.deepEqual(activeEntries, []);
  assert.deepEqual(activeEntries.filter(shouldRetryCreate), []);
});
