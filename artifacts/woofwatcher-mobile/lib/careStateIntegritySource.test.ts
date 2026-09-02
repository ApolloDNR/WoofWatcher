import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildPrincipalStorageKey,
  cacheBelongsToPrincipal,
  householdCacheIsCompatible,
} from "./careStateStorage.ts";
import { createSerializedCareSyncWriter } from "./serializedCareSyncWriter.ts";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readMobileFile(...parts: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...parts), "utf8");
}

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertInOrder(
  source: string,
  markers: readonly string[],
  message: string,
): void {
  let cursor = -1;
  for (const marker of markers) {
    const index = source.indexOf(marker, cursor + 1);
    assert.notEqual(index, -1, `${message}: missing ${marker}`);
    assert.ok(index > cursor, `${message}: ${marker} is out of order`);
    cursor = index;
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

test("keeps exact principal and household cache matching fail-closed", () => {
  assert.equal(
    buildPrincipalStorageKey("woofwatcher.v2.state", " account/a "),
    "woofwatcher.v2.state.account.account%2Fa",
  );
  assert.equal(cacheBelongsToPrincipal(undefined, "account/a"), false);
  assert.equal(cacheBelongsToPrincipal("account/a", "account/b"), false);
  assert.equal(cacheBelongsToPrincipal("account/a", "account/a"), true);
  assert.equal(householdCacheIsCompatible("house-a", "house-b"), false);
  assert.equal(householdCacheIsCompatible("house-a", null), false);

  const careContext = readMobileFile("context", "CareContext.tsx");
  const provider = section(
    careContext,
    "export function CareProvider",
    "function CareProviderSession",
  );
  assert.match(
    provider,
    /isClerkEnabledForBuild\s*&&\s*!isLoaded\s*\?\s*undefined/,
  );
  assert.match(provider, /`account:\$\{authenticatedStorageUserId\}`/);
  assert.match(provider, /<CareProviderSession[\s\S]*key=\{sessionKey\}/);

  const syncScope = section(
    careContext,
    "const responseUserId = normalizeStorageUserId(me.user?.id)",
    "const access = deriveCareStateWriteAccess",
  );
  assert.match(syncScope, /responseUserId\s*!==\s*authenticatedUserAtStart/);
  assert.match(syncScope, /if\s*\(\s*!householdId\s*\)/);
  assert.match(
    syncScope,
    /householdCacheIsCompatible\([\s\S]*previousStateHouseholdId[\s\S]*householdId/,
  );
  assert.match(
    syncScope,
    /householdCacheIsCompatible\([\s\S]*previousLedgerHouseholdId[\s\S]*householdId/,
  );

  const restore = section(
    syncScope,
    "const targetArchiveSuffix = encodeURIComponent(householdId)",
    "useFreshHouseholdStateOnly = !restoredTargetState",
  );
  assert.ok(
    (restore.match(/cacheBelongsToPrincipal\(/g)?.length ?? 0) >= 2,
    "both the state archive and cleanup ledger must match the exact owner",
  );
  assert.ok(
    (restore.match(
      /normalizeStorageUserId\([^)]*\.householdId\)\s*===\s*householdId/g,
    )?.length ?? 0) >= 2,
    "both restored archives must match the freshly verified household",
  );
});

test("drains cross-session writes before reading the scoped state and deletion ledger", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const hydration = section(
    careContext,
    "const hydrate = async (attempt: number)",
    "void hydrate(0)",
  );

  assertInOrder(
    hydration,
    [
      "await storageWriter.drain()",
      "hydrationWriterEpoch = storageWriter.currentEpoch()",
      "await readCacheAndDeletionLedger()",
      "applyDiscardedRaw(discardedRaw)",
      "applyRaw(raw)",
      "setHydrated(true)",
    ],
    "hydration must fence prior principals and load deletion intent first",
  );
  assert.match(
    careContext,
    /eraseGenerationAtHydrationStart\s*=\s*eraseGenerationRef\.current[\s\S]*eraseGenerationRef\.current\s*===\s*eraseGenerationAtHydrationStart/,
    "a cache read started before owner erase must never rehydrate deleted data",
  );

  assert.match(
    careContext,
    /buildPrincipalStorageKey\(\s*STORAGE_KEY,\s*storageUserId\s*\?\?\s*null/,
  );
  assert.match(
    careContext,
    /buildPrincipalStorageKey\(\s*DISCARDED_SERVER_ENTRY_IDS_KEY,\s*storageUserId\s*\?\?\s*null/,
  );
  assert.match(careContext, /ownerUserId:\s*storageUserId/);
  assert.match(careContext, /householdId:\s*storageHouseholdIdRef\.current/);
});

test("seals a household transition before archive IO and unmasks only target data", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const mismatch = section(
    careContext,
    "if (scopeMismatch)",
    "if (!scopeMismatch)",
  );

  assertInOrder(
    mismatch,
    [
      "pendingHouseholdArchiveRef.current = {",
      "householdScopeChangingRef.current = true",
      "persistencePausedRef.current = true",
      "setHouseholdScopeChanging(true)",
      "docRef.current = defaultDoc",
      "entriesRef.current = []",
      "await Promise.all([",
      ".household-archive.",
      "// Restore only an archive",
    ],
    "the old household must be hidden before storage or provider awaits",
  );

  const visibleState = section(
    careContext,
    "const state = useMemo<CareState>",
    "const syncOutbox = useMemo",
  );
  assert.match(
    visibleState,
    /householdScopeChanging\s*\?\s*getDefaultDoc\(\)\s*:\s*doc/,
  );
  assert.match(
    visibleState,
    /householdScopeChanging\s*\?\s*\[\]\s*:\s*entries/,
  );
  assert.match(
    visibleState,
    /version:\s*householdScopeChanging\s*\?\s*0\s*:\s*serverVersion/,
  );
  assert.match(
    careContext,
    /isLoaded:\s*hydrated\s*&&\s*!householdScopeChanging/,
  );
  assert.match(
    mismatch,
    /if\s*\(!previousHousehold\)[\s\S]*Previous household cache was unavailable/,
  );

  const pendingReturn = section(
    careContext,
    "const pendingHousehold = pendingHouseholdArchiveRef.current",
    "if (scopeMismatch)",
  );
  assertInOrder(
    pendingReturn,
    [
      "if (!scopeMismatch && pendingHousehold)",
      "persistencePausedRef.current = true",
      "const results = await Promise.all([",
      "key: stateStorageKey",
      "key: discardedEntryStorageKey",
      'result !== "applied"',
      "pendingHouseholdArchiveRef.current = null",
      "docRef.current = pendingHousehold.doc",
      "entriesRef.current = restoredPendingEntries",
    ],
    "a failed archive that returns to the same household must be durable before restoration",
  );
  assert.ok(
    (pendingReturn.match(/householdCacheIsCompatible\(/g)?.length ?? 0) >= 2,
    "a returning household may safely claim legacy null state or ledger scope",
  );

  const entryCommit = section(
    careContext,
    "const mergedEntries = mergeServerAndLocalEntries",
    "} catch {",
  );
  assertInOrder(
    entryCommit,
    [
      "setEntries(mergedEntries)",
      "persistencePausedRef.current = false",
      "householdScopeChangingRef.current = false",
      "setHouseholdScopeChanging(false)",
    ],
    "a successful transition must commit the target list before unmasking",
  );
});

test("uses three-way conflict recovery and never overlays the whole local document", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const pushDoc = section(
    careContext,
    "const pushDoc = useCallback",
    "const persistEntryCreate = useCallback",
  );

  assert.match(
    pushDoc,
    /confirmedBaseAtStart\s*=\s*lastServerCareStateRef\.current\?\.doc/,
  );
  assert.match(
    pushDoc,
    /mergeCareDocThreeWay\(\{[\s\S]*base:\s*confirmedBaseAtStart,[\s\S]*local:\s*localDraft,[\s\S]*remote:\s*remoteDoc/,
  );
  assert.match(pushDoc, /if\s*\(mergeResult\.status\s*===\s*"conflict"\)/);
  assert.match(
    pushDoc,
    /\.care-doc-conflict\.[\s\S]*conflictPaths,[\s\S]*draftPreserved\s*=\s*result\s*===\s*"applied"[\s\S]*if\s*\(!resultIsCurrent\(\)\)\s*return;[\s\S]*applyAuthoritativeCareState\(remoteEnvelope\)[\s\S]*presentCareDocBlockedNotice\(/,
    "conflicting drafts must be attempted durably before authoritative server truth is shown",
  );
  assert.ok(
    (pushDoc.match(/preserveConflictAndAdoptRemote\(/g)?.length ?? 0) >= 2,
    "both the initial 409 and retry 409 must use durable conflict recovery",
  );
  assert.match(
    pushDoc,
    /if\s*\(retryMerge\.status\s*===\s*"conflict"\)\s*\{[\s\S]*preserveConflictAndAdoptRemote\([\s\S]*retryMerge\.conflictPaths/,
  );
  assert.doesNotMatch(
    pushDoc,
    /\{\s*\.\.\.\s*(?:remoteDoc|serverWinner)[\s\S]{0,120}\.\.\.\s*(?:localDraft|docRef\.current)/,
    "whole-document local overlay can clobber another caregiver's edits",
  );
});

test("invalidates verified household scope on every stale entry mutation", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const updateFailure = section(
    careContext,
    "onFailure: (entryId, localEntry, error)",
    "const entryUpdateQueue = entryUpdateQueueRef.current",
  );
  assert.match(
    updateFailure,
    /isHouseholdScopeChangedError\(error\)[\s\S]*invalidateHouseholdScopeRef\.current\(\)/,
  );

  const create = section(
    careContext,
    "const persistEntryCreate = useCallback",
    "const persistEntryUpdate = useCallback",
  );
  assert.ok(
    (create.match(
      /isHouseholdScopeChangedError\(error\)[\s\S]{0,180}invalidateHouseholdScopeRef\.current\(\)/g,
    )?.length ?? 0) >= 2,
    "CREATE and its compensating DELETE must both observe a stale household",
  );

  const remove = section(
    careContext,
    "const deleteEntry = useCallback",
    "const updateEntry = useCallback",
  );
  assert.match(
    remove,
    /isHouseholdScopeChangedError\(error\)[\s\S]*restoreEntryAfterDeleteFailure\([\s\S]*invalidateHouseholdScopeRef\.current\(\)/,
    "a stale DELETE must restore its draft before starting household re-verification",
  );
  const genericFailure = section(
    remove,
    "// Never restore across an owner wipe",
    "} finally {",
  );
  assertInOrder(
    genericFailure,
    [
      "restoreEntryAfterDeleteFailure(",
      "await clearDiscardedServerEntry(discardedId)",
      "eraseGenerationRef.current !== eraseGenerationAtStart",
    ],
    "a failed delete must restore before cleanup and recheck owner erase after each await",
  );
  assert.match(
    remove,
    /deletionLedgerIds\.push\(realId\)/,
    "every acknowledged delete must be durable and serialized against household refresh",
  );
  assert.match(
    remove,
    /entryDeletesInFlightRef\.current\s*\+=\s*1[\s\S]*await runCareSyncRequestWithTimeout\([\s\S]*deleteCareEntry/,
  );
  assert.match(
    remove,
    /finally\s*\{[\s\S]*entryDeletesInFlightRef\.current\s*=\s*Math\.max[\s\S]*syncRequestedRef\.current/,
  );
});

test("fences forbidden-write recovery across erase and stale household responses", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const recovery = section(
    careContext,
    "const handleCareStateWriteForbidden = useCallback",
    "useEffect(() => {",
  );
  assert.match(
    recovery,
    /catch\s*\(error\)[\s\S]*isHouseholdScopeChangedError\(error\)[\s\S]*invalidateHouseholdScope\(\)/,
  );
  assert.match(
    recovery,
    /finally\s*\{[\s\S]*eraseGenerationRef\.current\s*===\s*eraseGenerationAtStart[\s\S]*authenticatedUserIdRef\.current\s*===\s*authenticatedUserAtStart[\s\S]*careDocRecoveryInFlightRef\.current\s*=\s*false/,
    "an old recovery must not unlock a post-erase recovery",
  );
});

test("backs off repeated household-scope verification failures", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const invalidation = section(
    careContext,
    "const scheduleHouseholdScopeRetry = useCallback",
    "const handleCareStateWriteForbidden = useCallback",
  );
  assert.match(invalidation, /setTimeout\([\s\S]*2_000\)/);
  assert.match(
    invalidation,
    /if\s*\(syncingRef\.current\)[\s\S]*syncRequestedRef\.current\s*=\s*false[\s\S]*scheduleHouseholdScopeRetry\(\)[\s\S]*return/,
  );

  const sync = section(
    careContext,
    "const syncFromServer = useCallback",
    "const addEntry = useCallback",
  );
  assert.match(
    sync,
    /if\s*\(!householdScopeReady\)[\s\S]*syncRequestedRef\.current\s*=\s*false[\s\S]*scheduleHouseholdScopeRetry\(\)/,
    "a failed active sync must schedule a bounded retry instead of a trailing microtask",
  );
  assert.match(
    sync,
    /syncingRef\.current\s*\|\|[\s\S]*careDocWritesInFlightRef\.current\s*>\s*0\s*\|\|[\s\S]*entryDeletesInFlightRef\.current\s*>\s*0/,
    "household reconciliation must wait for acknowledged deletes",
  );
  assert.match(
    sync,
    /householdScopeInvalidationGenerationRef\.current\s*===\s*householdScopeInvalidationAtStart/,
    "scope invalidation must fence the rest of an already-running sync",
  );
  assert.match(
    sync,
    /entryDeleteGenerationRef\.current\s*===\s*entryDeleteGenerationAtStart/,
    "a delete begun during refresh must fence that stale refresh result",
  );
});

test("binds every post-verification care request to the expected household", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  assert.match(
    careContext,
    /HOUSEHOLD_SCOPE_HEADER\s*=\s*"x-woofwatcher-household-id"/,
  );
  assert.ok(
    (careContext.match(/householdScopedRequest\(/g)?.length ?? 0) >= 14,
    "the helper plus every care-state and care-entry request must carry the verified household",
  );
  for (const request of [
    "getCareState",
    "putCareState",
    "listCareEntries",
    "createCareEntry",
    "updateCareEntry",
    "deleteCareEntry",
  ]) {
    assert.match(
      careContext,
      new RegExp(`${request}\\([\\s\\S]{0,260}householdScopedRequest\\(`),
      `${request} must carry the expected household scope`,
    );
  }
});

test("bounds every CareContext-owned provider request", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const wrappedRequestCount = (request: string) =>
    careContext.match(
      new RegExp(
        `runCareSyncRequestWithTimeout\\(\\(signal\\) =>\\s*${request}\\(`,
        "g",
      ),
    )?.length ?? 0;

  assert.equal(wrappedRequestCount("getMe"), 2);
  assert.equal(wrappedRequestCount("getCareState"), 2);
  assert.equal(wrappedRequestCount("putCareState"), 2);
  assert.equal(wrappedRequestCount("listCareEntries"), 1);
  assert.equal(wrappedRequestCount("createCareEntry"), 1);
  assert.equal(wrappedRequestCount("deleteCareEntry"), 4);

  const queuedMutations = section(
    careContext,
    "if (!entryUpdateQueueRef.current)",
    "const entryUpdateQueue = entryUpdateQueueRef.current",
  );
  assert.ok(
    (queuedMutations.match(/householdScopedRequest\([^,]+,\s*signal\)/g)
      ?.length ?? 0) >= 3,
    "the timeout-owned update queue must pass its signal to PATCH and conflict LIST",
  );
});

test("serialized owner erase seals producers and propagates wipe failures", () => {
  const careContext = readMobileFile("context", "CareContext.tsx");
  const erase = section(
    careContext,
    "const eraseAllLocalData = useCallback",
    "const value = useMemo<CareContextValue>",
  );

  assertInOrder(
    erase,
    [
      "if (eraseInFlightRef.current) return eraseInFlightRef.current",
      "persistencePausedRef.current = true",
      "hydratedRef.current = false",
      "householdScopeChangingRef.current = true",
      "pendingHouseholdArchiveRef.current = null",
      "await markServerEntryDiscarded(tempId)",
      "entryUpdateQueue.cancelAll()",
      "await storageWriter.supersede({",
      'kind: "wipe"',
      "await Promise.all(",
      "FileSystem.deleteAsync(",
    ],
    "erase must seal, retain cleanup intent, serialize the wipe, then delete files",
  );
  assert.match(
    erase,
    /catch\s*\(error\)\s*\{[\s\S]*setStorageWarning\("save-failed"\);[\s\S]*throw error/,
  );
  assert.match(erase, /eraseInFlightRef\.current\s*=\s*operation/);
  assert.match(erase, /return operation/);
  assert.doesNotMatch(
    erase,
    /AsyncStorage\.(?:getAllKeys|multiRemove|removeItem)\(/,
  );
});

test("privacy reports success only when every deletion participant resolves", () => {
  const privacy = readMobileFile("app", "privacy.tsx");
  const eraseFlow = section(privacy, "const advanceEraseFlow", "return (");

  assertInOrder(
    eraseFlow,
    [
      "const avatarResults = await Promise.allSettled([",
      "clearAvatarSet()",
      "resetAvatarConfig()",
      "const careResults = await Promise.allSettled([eraseAllLocalData()])",
      "const results = [...avatarResults, ...careResults]",
      'results.every((result) => result.status === "fulfilled")',
      '? "done"',
      ': "failed"',
    ],
    "avatar reset writes must settle before the care wipe performs the terminal key removal",
  );
  assert.match(eraseFlow, /\.finally\(\(\) => setErasing\(false\)\)/);
  assert.doesNotMatch(
    eraseFlow,
    /Promise\.allSettled\(\[[\s\S]{0,120}eraseAllLocalData\(\)[\s\S]{0,120}(?:clearAvatarSet|resetAvatarConfig)\(\)/,
  );
  assert.doesNotMatch(eraseFlow, /\.finally\([^)]*setEraseStage\("done"\)/);
});

test("a failed superseding wipe settles drain and fences every stale epoch", async () => {
  const activeGate = deferred<void>();
  const writes: string[] = [];
  const writer = createSerializedCareSyncWriter<string>(async (value) => {
    writes.push(value);
    if (value === "active") await activeGate.promise;
    if (value === "wipe") throw new Error("wipe rejected");
  });
  const staleEpoch = writer.currentEpoch();
  const active = writer.enqueue("active", staleEpoch);
  const critical = writer.enqueue("cleanup-ledger", staleEpoch, "critical");
  const snapshot = writer.enqueue("private-snapshot", staleEpoch);
  const wipe = writer.supersede("wipe");

  assert.equal(await snapshot, "superseded");
  assert.equal(
    await writer.enqueue("late-cleanup", staleEpoch, "critical"),
    "superseded",
  );
  activeGate.resolve();
  assert.equal(await active, "applied");
  assert.equal(await critical, "applied");
  await assert.rejects(wipe, /wipe rejected/);
  await writer.drain();

  assert.equal(await writer.enqueue("fresh"), "applied");
  assert.deepEqual(writes, ["active", "cleanup-ledger", "wipe", "fresh"]);
});
