import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../context/CareContext.tsx", import.meta.url),
  "utf8",
);

test("CareContext retains authoritative creator identity from server rows", () => {
  assert.match(
    source,
    /export interface Entry[\s\S]*caregiverUserId\?: string/,
  );
  assert.match(
    source,
    /function toEntry\(c: ApiCareEntry\)[\s\S]*caregiverUserId:\s*c\.caregiverUserId \?\? undefined/,
  );
});

test("signed-in hydration filters owner-private cache rows before interrupted mutations can retry", () => {
  const hydration = source.slice(
    source.indexOf("const stageCareHydration"),
    source.indexOf("const applyStagedCareHydration"),
  );
  assert.match(
    hydration,
    /selectedSnapshot\.entries[\s\S]*partitionCareEntriesForSignedInUser\([\s\S]*signedInUserId/,
  );
  assert.match(
    hydration,
    /partitionCachedCareEntriesByDiscardedIdentity\(\s*cachedPrivacy\.retained,\s*discardedServerEntryIds/,
  );
  assert.match(
    hydration,
    /await carePersistenceWriter\.enqueue\([\s\S]*recoverInterruptedCareEntryMutations\(\s*cachedDeletion\.retained/,
  );
  assert.match(hydration, /vault\.quarantine\.push\(/);
  assert.match(hydration, /cachedPrivacy\.quarantined/);
});

test("fresh server rows are privacy-filtered by the exact permit user before merging or retrying", () => {
  const refresh = source.slice(
    source.indexOf("const recentlySuppressed"),
    source.indexOf("const retryableCreates"),
  );
  assert.match(
    refresh,
    /partitionCareEntriesForSignedInUser\([\s\S]*serverEntries[\s\S]*authPermit\.userId/,
  );
  assert.match(
    refresh,
    /mergeServerAndLocalEntries\([\s\S]*serverPrivacy\.retained/,
  );
});

test("signed-in local private creation stamps the exact current auth user", () => {
  const addEntry = source.slice(
    source.indexOf("const addEntry = useCallback"),
    source.indexOf("const deleteEntry = useCallback"),
  );
  assert.match(addEntry, /stampSignedInPrivateCareEntryCreator\(/);
  assert.match(addEntry, /authIdentityBoundary\.snapshot\(\)\.userId/);
});

test("signed-in local private edits are restamped to the exact current auth user", () => {
  const updateEntry = source.slice(
    source.indexOf("const updateEntry = useCallback"),
    source.indexOf("const updateCareDoc = useCallback"),
  );
  assert.match(updateEntry, /stampSignedInPrivateCareEntryCreator\(/);
  assert.match(updateEntry, /authIdentityBoundary\.snapshot\(\)\.userId/);
});

test("an exact current PATCH 404 revokes the durable row before the generic failure path can retry it", () => {
  const queue = source.slice(
    source.indexOf("createSerializedCareEntryMutationQueue<Entry"),
    source.indexOf("const entryUpdateQueue = entryUpdateQueueRef.current"),
  );
  const failure = queue.slice(queue.indexOf("onFailure:"));

  assert.match(failure, /applyExactCareEntryNotFoundRevocation\(/);
  assert.match(failure, /authIdentityBoundary\.canContinue\(authPermit\)/);
  assert.match(failure, /entryUpdateQueueRef\.current\?\.cancel\(revokedId\)/);
  assert.match(
    failure,
    /entryWriteGenerationRef\.current\.delete\(revokedId\)/,
  );
  assert.match(failure, /entryAuthPermitRef\.current\.delete\(revokedId\)/);
  assert.match(failure, /careIdentityVaultRef\.current\.quarantine\.push\(/);
  assert.match(
    failure,
    /writeCareIdentitySlot<PersistedCareIdentitySnapshot>\(/,
  );
  assert.match(failure, /entriesRef\.current = retained/);
  assert.match(failure, /setEntries\(retained\)/);
  assert.match(
    failure,
    /persistCareEntryRevocationSuppression\(\{[\s\S]*persistCleanupLedger:[\s\S]*await markServerEntryDiscarded\([\s\S]*persistIdentitySlot: persistCurrentCareSnapshot/,
  );
  assert.match(failure, /setCareStorageWarning\("save-failed"\)/);
  assert.match(
    failure,
    /if \(revocation\.status !== "not-revoked"\) return;[\s\S]*syncStatus: "failed"/,
  );
});

test("an exact current CREATE 410 awaits durable identity cleanup before suppressing retry", () => {
  const create = source.slice(
    source.indexOf("const persistEntryCreate = useCallback"),
    source.indexOf("const persistEntryUpdate = useCallback"),
  );

  assert.match(create, /createAttemptTokenByTemp\.current\.set\(/);
  assert.match(
    create,
    /createAttemptTokenByTemp\.current\.get\(tempId\) === createAttemptToken/,
  );
  assert.match(
    create,
    /isCurrentAttempt[\s\S]*applyExactCareEntryCreateRevocation\(/,
  );
  assert.match(
    create,
    /persistCareEntryRevocationSuppression\(\{[\s\S]*persistCleanupLedger:[\s\S]*await markServerEntryDiscarded\([\s\S]*persistIdentitySlot: persistCurrentCareSnapshot/,
  );
  assert.match(create, /const revocationResult = await revocation/);
  assert.match(
    create,
    /if \(revocationResult\.status !== "not-revoked"\) return;/,
  );
  assert.match(create, /setCareStorageWarning\("save-failed"\)/);
});

test("initial and mounted refreshes release server-id fallbacks only after the merged clean slot is durable", () => {
  const refresh = source.slice(
    source.indexOf("const syncFromServer = useCallback"),
    source.indexOf("const retryInitialSync = useCallback"),
  );
  const commitIndex = refresh.indexOf("commitRefs(nextDoc)");
  const releaseIndex = refresh.indexOf(
    "await releaseCareEntryRevocationSuppression",
  );
  const settlementIndex = refresh.indexOf("initialSyncLifecycle.succeed()");

  assert.ok(commitIndex >= 0);
  assert.ok(releaseIndex > commitIndex);
  assert.ok(settlementIndex > releaseIndex);
  assert.match(
    refresh,
    /discardedIdsReadyForRelease\.add\(discardedId\)[\s\S]*partitionCachedCareEntriesByDiscardedIdentity\([\s\S]*localPrivacy\.retained[\s\S]*entriesRef\.current = mergedEntries/,
  );
  assert.match(
    refresh,
    /persistIdentitySlot:[\s\S]*await persistCurrentCareSnapshot\(\)[\s\S]*clearCleanupLedger:[\s\S]*await clearDiscardedServerEntry/,
  );
  assert.match(
    refresh,
    /if \(!cleared\)[\s\S]*Care cleanup ledger could not be released/,
  );
  assert.match(
    source,
    /const clearDiscardedServerEntry[\s\S]*catch \{[\s\S]*addDiscardedServerEntryId\([\s\S]*recentlyDiscardedServerEntryIdsRef\.current\.add\(entryId\)[\s\S]*return false/,
  );
});

test("a capped care-entry page can never release a server-id fallback without an exact DELETE result", () => {
  const refresh = source.slice(
    source.indexOf("const syncFromServer = useCallback"),
    source.indexOf("const retryInitialSync = useCallback"),
  );
  const exactDeleteIndex = refresh.indexOf(
    "deleteCareEntry(\n                discardedId",
  );
  const releaseIndex = refresh.indexOf(
    "discardedIdsReadyForRelease.add(discardedId)",
    exactDeleteIndex,
  );

  assert.doesNotMatch(refresh, /rowsById/);
  assert.ok(exactDeleteIndex >= 0);
  assert.ok(releaseIndex > exactDeleteIndex);
  assert.match(
    refresh,
    /deleteCareEntry\(\s*discardedId[\s\S]*if \(!isNotFound\(error\)\) throw error;[\s\S]*discardedIdsReadyForRelease\.add\(discardedId\)/,
  );
});

test("a cancelled create outside the capped page uses the authoritative client-key deletion endpoint before local release", () => {
  const refresh = source.slice(
    source.indexOf("const syncFromServer = useCallback"),
    source.indexOf("const retryInitialSync = useCallback"),
  );
  const tempBranch = refresh.slice(
    refresh.indexOf('if (discardedId.startsWith("temp_"))'),
    refresh.indexOf(
      "\n        try {\n          if (!canContinue())",
      refresh.indexOf('if (discardedId.startsWith("temp_"))') + 1,
    ),
  );
  const exactDeleteIndex = tempBranch.indexOf(
    "deleteCareEntryByClientKey(",
  );
  const releaseIndex = tempBranch.indexOf(
    "discardedIdsReadyForRelease.add(discardedId)",
  );

  assert.ok(exactDeleteIndex >= 0);
  assert.ok(releaseIndex > exactDeleteIndex);
  assert.match(
    tempBranch,
    /deleteCareEntryByClientKey\(\s*discardedId,\s*expectedHouseholdHeaders\(authPermit\.householdId\)/,
  );
  assert.doesNotMatch(tempBranch, /rowsByClientKey|matchingRows|listCareEntries/);
  assert.match(
    refresh,
    /entriesRef\.current = mergedEntries[\s\S]*persistIdentitySlot:[\s\S]*await persistCurrentCareSnapshot\(\)[\s\S]*clearCleanupLedger:/,
    "the remote tombstone must precede clean-slot persistence and local ledger release",
  );
});
