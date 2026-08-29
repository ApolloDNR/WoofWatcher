import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();

const CARE_CONTEXT_PATH = join(MOBILE_ROOT, "context", "CareContext.tsx");
const CARE_TEAM_SUPPLIES_PATH = join(
  MOBILE_ROOT,
  "components",
  "more",
  "CareTeamSuppliesScreen.tsx",
);

function sourceSlice(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `missing start anchor: ${start}`);
  assert.notEqual(endAt, -1, `missing end anchor: ${end}`);
  return source.slice(startAt, endAt);
}

test("CareContext exposes a real protected local-hydration retry", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const hydration = sourceSlice(
    source,
    "// Hydrate instantly from the offline cache",
    "// Persist the offline cache whenever synced state changes.",
  );

  assert.match(source, /retryLocalHydration:\s*\(\) => void/);
  assert.match(source, /const retryLocalHydration = useCallback/);
  assert.match(source, /setLocalHydrationRetryEpoch/);
  assert.match(hydration, /localHydrationRetryEpoch/);
  assert.match(hydration, /careHydrationAttemptAuthorityRef\.current!\.begin/);
  assert.match(
    hydration,
    /if \(staged\.futureDoc\)[\s\S]*preserveFutureCareDoc\(staged\.futureDoc\)[\s\S]*else \{[\s\S]*setStorageWarning\(staged\.warning\)/,
  );
  assert.doesNotMatch(
    sourceSlice(source, "const retryLocalHydration =", "// Hydrate instantly"),
    /syncFromServer|getCareState|listCareEntries/,
  );
});

test("CareContext readiness is auth-cycle aware and settles only after a successful refresh", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const sync = sourceSlice(
    source,
    "const syncFromServer = useCallback",
    "const addEntry = useCallback",
  );

  assert.match(source, /isInitialSyncSettled:\s*boolean/);
  assert.match(source, /initialSyncStatus:\s*CareInitialSyncStatus/);
  assert.match(source, /retryInitialSync:\s*\(\) => void/);
  assert.match(source, /createCareInitialSyncReadiness/);
  assert.match(source, /createCareAuthIdentityBoundary/);
  assert.match(
    source,
    /authIdentityBoundary\.observe\(\{[\s\S]*clerkLoaded,[\s\S]*userId:\s*normalizedUserId,[\s\S]*sessionId:\s*normalizedSessionId,[\s\S]*householdId:\s*resolvedHouseholdId/,
  );
  assert.match(source, /createCareHouseholdIdentityResolution\(\)/);
  assert.match(
    source,
    /JSON\.stringify\(\[normalizedUserId, normalizedSessionId, null\]\)/,
  );
  assert.match(source, /householdIdentityResolution\.captureAttempt\(\)/);
  assert.match(
    source,
    /getMe\(\{[\s\S]{0,100}signal:\s*controller\.signal,[\s\S]{0,80}cache:\s*"no-store"/,
  );
  assert.match(
    source,
    /householdIdentityResolution\.settleFreshMe\(attempt, me\)/,
  );
  assert.match(source, /householdIdentityResolution\.captureRetry\(/);
  assert.match(source, /householdIdentityResolution\.restartResolution\(\)/);
  assert.match(source, /identityScopeKey:\s*string \| null/);
  assert.match(source, /identityScopeStatus:\s*CareIdentityScopeStatus/);
  assert.match(source, /retryIdentityScope:\s*\(\) => void/);
  assert.match(source, /restartIdentityScope:\s*\(\) => void/);
  assert.match(sync, /beginCareInitialSyncLifecycle\(\{/);
  assert.match(
    sync,
    /readLocalDoc:\s*\(\) => \(\{[\s\S]*revision:\s*docRevisionRef\.current,[\s\S]*doc:\s*docRef\.current/,
  );
  assert.match(sync, /authIdentityBoundary\.captureSignedIn\(\)/);
  assert.match(
    sync,
    /authIdentityBoundary\.canContinue\(authPermit\)[\s\S]*activeDataScopeRef\.current === authPermit\.dataScope[\s\S]*careWriteCanContinue/,
  );
  assert.match(sync, /runAtomicCareInitialRefresh\(\{/);
  assert.match(sync, /fetchDoc:\s*\(\) => runHouseholdBoundRequest/);
  assert.match(sync, /fetchEntries:\s*\(\) => runHouseholdBoundRequest/);
  assert.match(sync, /expectedHouseholdHeaders\(authPermit\.householdId\)/);
  assert.match(sync, /initialSyncLifecycle\.commitDoc\(/);
  assert.match(
    sync,
    /docRef\.current = safeDoc[\s\S]*entriesRef\.current = mergedEntries[\s\S]*versionRef\.current = nextServerVersion[\s\S]*const committedEntries = entriesRef\.current;[\s\S]*setDoc\(nextDoc\)[\s\S]*setEntries\(committedEntries\)[\s\S]*setServerVersion\(nextServerVersion\)/,
  );
  assert.match(sync, /initialSyncLifecycle\.succeed\(\)/);
  assert.match(sync, /initialSyncLifecycle\.finish\(/);
  assert.match(
    sync,
    /initialSyncLifecycle\?\.failForFutureSchema\(envelope\.doc\)/,
  );
  assert.match(sync, /initialSyncLifecycle\?\.failForFutureSchema\(res\.doc\)/);
  assert.match(
    sync,
    /initialSyncLifecycle\?\.failForFutureSchema\(conflictDoc\)/,
  );
  const syncFailure = sourceSlice(
    sync,
    "} catch (error) {\n      // Offline or transient failure",
    "} finally {",
  );
  assert.match(
    syncFailure,
    /if \(!canContinue\(\)\) return;[\s\S]*const conflictDoc[\s\S]*preserveFutureCareDoc\(conflictDoc\)/,
    "a stale identity's conflict must be rejected before future-schema protection can affect the current identity",
  );
  assert.match(
    source,
    /authSyncRetryEpoch,[\s\S]{0,160}operationSettledEpoch,[\s\S]{0,80}syncFromServer/,
  );
  assert.match(sync, /setInitialSyncReadinessRevision/);
  assert.match(sync, /setAuthSyncRetryEpoch/);
  assert.match(source, /isInitialSyncSettled,/);
});

test("CareContext validates exact household authority around every remote Care request", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const requestBoundary = sourceSlice(
    source,
    "const runHouseholdBoundRequest = useCallback",
    "useEffect(() => {\n    docRef.current = doc;",
  );
  const remoteCallNames = [
    "getCareState",
    "putCareState",
    "listCareEntries",
    "createCareEntry",
    "updateCareEntry",
    "deleteCareEntryByClientKey",
    "deleteCareEntry",
  ] as const;

  assert.match(
    requestBoundary,
    /assertCareHouseholdSuccessAuthority\([\s\S]*permit\.householdId/,
  );
  assert.match(
    requestBoundary,
    /assertCareHouseholdConflictAuthority\(error, permit\.householdId\)/,
  );
  assert.match(
    requestBoundary,
    /catch \(error\) \{[\s\S]*if \(!authIdentityBoundary\.canContinue\(permit\)\) \{[\s\S]*throw error;[\s\S]*assertCareHouseholdConflictAuthority/,
    "stale household failures must be inert before conflict validation or authority revocation",
  );
  assert.match(requestBoundary, /status === 412[\s\S]*status === 428/);
  for (const callName of remoteCallNames) {
    const callPattern = new RegExp(`\\b${callName}\\s*\\(`, "g");
    const callCount = [...source.matchAll(callPattern)].length;
    assert.ok(
      callCount > 0,
      `${callName} must remain exercised by CareContext`,
    );
  }
  const remoteCallCount = [
    ...source.matchAll(
      /\b(?:getCareState|putCareState|listCareEntries|createCareEntry|updateCareEntry|deleteCareEntryByClientKey|deleteCareEntry)\s*\(/g,
    ),
  ].length;
  const householdQueryKeyCount = [
    ...source.matchAll(/\bgetListCareEntriesHouseholdQueryKey\s*\(/g),
  ].length;
  assert.equal(
    [...source.matchAll(/\bexpectedHouseholdHeaders\s*\(/g)].length - 1,
    remoteCallCount + householdQueryKeyCount,
    "every generated Care request and manual cache operation must carry the exact expected-household capability",
  );
  assert.doesNotMatch(
    source,
    /headers:\s*expectedHouseholdHeaders/,
    "required household identity must use the generated typed argument rather than RequestInit",
  );
  assert.equal(
    [...source.matchAll(/\{ allowVoid: true \}/g)].length,
    [
      ...source.matchAll(
        /\b(?:deleteCareEntryByClientKey|deleteCareEntry)\s*\(/g,
      ),
    ].length,
    "only DELETE success paths may admit a void response",
  );
});

test("initial admission awaits exact pending mutation reconciliation and publishes live refs", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const sync = sourceSlice(
    source,
    "const syncFromServer = useCallback",
    "const retryInitialSync = useCallback",
  );
  const reconciliation = sourceSlice(
    sync,
    "const retryableCreates = mergedEntries.filter",
    "if (shouldRepushConcurrentLocalDoc",
  );

  assert.match(
    reconciliation,
    /initialSyncLifecycle[\s\S]*await Promise\.all\(\[[\s\S]*persistEntryCreate\(entry\.id, entry\)[\s\S]*persistEntryUpdate\(entry\.id, entry\)/,
  );
  assert.match(
    reconciliation,
    /unresolvedCreate[\s\S]*isUnsyncedEntry\(entry\)[\s\S]*unresolvedUpdate[\s\S]*isUnsyncedEntry\(entry\)/,
  );
  assert.match(
    reconciliation,
    /const persisted = await persistCurrentCareSnapshot\(\)[\s\S]*if \(!persisted \|\| !canContinue\(\)\)/,
  );
  assert.match(
    reconciliation,
    /const committedEntries = entriesRef\.current;[\s\S]*setEntries\(committedEntries\)[\s\S]*initialSyncLifecycle\.succeed\(\)/,
    "terminal callbacks must be re-read instead of republishing the pre-reconciliation merge",
  );
  assert.match(
    sync,
    /if \(!initialSyncLifecycle\) \{[\s\S]*void persistEntryCreate[\s\S]*void persistEntryUpdate/,
    "only already-admitted refreshes may retain fire-and-forget retry behavior",
  );
  assert.match(
    source,
    /return entryUpdateQueue\.enqueueAndWait\(id, pendingEntry\)/,
  );
});

test("CareContext revokes helper expiry and bounds membership-list rediscovery at provider scope", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");

  assert.match(source, /createCareHouseholdExpiryRevocation\(\)/);
  assert.match(
    source,
    /useLayoutEffect\(\(\) => \{[\s\S]*householdIdentitySnapshot\.state !== "resolved"[\s\S]*householdIdentityResolution\.activeAccessLease\(\)[\s\S]*revokeHouseholdAuthority/,
  );
  assert.match(source, /import \{ AppState \} from "react-native"/);
  assert.match(
    source,
    /AppState\.currentState !== "active"[\s\S]*householdIdentityResolution\.captureAttempt\(\)/,
    "backgrounded Care must not start fresh authority transport",
  );
  assert.match(
    source,
    /AppState\.addEventListener\([\s\S]*"change"[\s\S]*householdAuthorityPending[\s\S]*hasTemporaryAccess[\s\S]*revokeHouseholdAuthority\(\)/,
    "temporary or still-unknown household authority must revoke on background",
  );
  assert.match(
    source,
    /nextState === "active"[\s\S]*setHouseholdForegroundEpoch/,
    "foreground resume must require fresh Exact Me",
  );
  assert.match(
    source,
    /createHouseholdMembershipRediscoveryController\(\)/,
  );
  assert.match(
    source,
    /rediscoverIdentityScopeFromMembershipList:[\s\S]*CareAuthIdentityPermit[\s\S]*=> boolean/,
  );
  assert.match(
    source,
    /householdMembershipRediscovery\.request\(permit\)[\s\S]*revokeHouseholdAuthority\(\)[\s\S]*rejectHouseholdAuthority\(\)/,
  );
  assert.match(
    source,
    /rejectHouseholdAuthority[\s\S]*householdIdentityResolution\.rejectAuthority\(\)/,
  );
  assert.match(
    source,
    /confirmHouseholdMembershipListHealthy:[\s\S]*CareAuthIdentityPermit[\s\S]*=> boolean/,
  );
});

test("an auth or household generation change clears identity-owned transient mutation state", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const transition = sourceSlice(
    source,
    "if (observedAuthGenerationRef.current === authIdentity.generation) return;",
    "const currentScopeLoaded =",
  );

  assert.match(transition, /entryUpdateQueue\.cancelAll\(\)/);
  assert.match(transition, /entryWriteGenerationRef\.current\.clear\(\)/);
  assert.match(transition, /entryAuthPermitRef\.current\.clear\(\)/);
  assert.match(
    transition,
    /authorizedEntryMutationRef\.current = new WeakMap\(\)/,
  );
  assert.match(transition, /realIdByTemp\.current\.clear\(\)/);
  assert.match(transition, /pendingPatch\.current\.clear\(\)/);
  assert.match(transition, /cancelledTempEntries\.current\.clear\(\)/);
  assert.match(transition, /creatingTempEntries\.current\.clear\(\)/);
  assert.match(
    transition,
    /recentlyDiscardedServerEntryIdsRef\.current\.clear\(\)/,
  );
});

test("joining suspends household resolution and closes A before transport", () => {
  const care = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const source = readFileSync(CARE_TEAM_SUPPLIES_PATH, "utf8");
  const submitJoin = sourceSlice(
    source,
    "const submitJoin = () => {",
    "const submitRename = () => {",
  );
  assert.match(
    source,
    /const renderHouseholdOperationPermit =\s*captureCareHouseholdOperationPermit\(\)/,
  );
  assert.match(
    source,
    /isCareHouseholdOperationPermitCurrent\(renderHouseholdOperationPermit\)/,
  );
  assert.match(
    submitJoin,
    /beginCareTransition: beginCareHouseholdTransition,[\s\S]*prepareQueryTransition: prepareHouseholdTransition,[\s\S]*runTrackedTransport:[\s\S]*joinTransport:/,
  );
  assert.match(
    care,
    /householdTransitionController\.begin\(permit\)[\s\S]*authIdentityBoundary\.observe\(\{[\s\S]*householdId: null,[\s\S]*householdIdentityResolution\.restartResolution\(\)/,
  );
  assert.match(
    care,
    /if \(!householdTransitionController\.canResolveHousehold\(\)\) return;/,
  );
  assert.doesNotMatch(submitJoin, /\brefreshMe\s*\(/);
  assert.doesNotMatch(submitJoin, /\brefresh\s*\(/);
  assert.doesNotMatch(submitJoin, /invalidateQueries|refetchQueries/);
});

test("CareContext isolates rendered and persisted snapshots by user data scope", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const hydration = sourceSlice(
    source,
    "// Hydrate instantly from the offline cache",
    "// Persist the offline cache whenever synced state changes.",
  );
  const state = sourceSlice(
    source,
    "const visibleDoc =",
    "const beginCoordinatedCareReset =",
  );

  assert.match(source, /createCareIdentityVault\(\)/);
  assert.match(source, /writeCareIdentitySlot<PersistedCareIdentitySnapshot>/);
  assert.match(source, /serializeCareIdentityVault/);
  assert.match(hydration, /parseCareIdentityVault\(raw, dataScope\)/);
  assert.match(
    hydration,
    /readCareIdentitySlot<PersistedCareIdentitySnapshot>/,
  );
  assert.match(
    hydration,
    /activeDataScopeRef\.current = null[\s\S]*setHydrated\(false\)/,
  );
  assert.match(
    hydration,
    /pendingScopeTransitionSnapshotRef\.current = \{[\s\S]*dataScope: previousDataScope,[\s\S]*snapshot: previousSnapshot/,
  );
  assert.match(
    hydration,
    /const pendingTransition = pendingScopeTransitionSnapshotRef\.current[\s\S]*writeCareIdentitySlot\([\s\S]*pendingTransition\.dataScope,[\s\S]*pendingTransition\.snapshot/,
  );
  assert.match(
    hydration,
    /careIdentityVaultRef\.current = staged\.vault;[\s\S]*pendingScopeTransitionSnapshotRef\.current = null/,
  );
  assert.match(
    hydration,
    /activeDataScopeRef\.current = dataScope[\s\S]*setHydrated\(true\)/,
  );
  assert.match(
    state,
    /currentScopeLoaded \? doc : hiddenIdentityDocRef\.current/,
  );
  assert.match(
    state,
    /currentScopeLoaded[\s\S]*\? entries[\s\S]*: EMPTY_IDENTITY_SCOPED_ENTRIES/,
  );
  assert.match(state, /entries:\s*visibleEntries/);
});

test("every remote Care mutation is authorized by its exact auth generation", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const pushDoc = sourceSlice(
    source,
    "const pushDoc = useCallback",
    "const persistEntryCreate = useCallback",
  );
  const create = sourceSlice(
    source,
    "const persistEntryCreate = useCallback",
    "const persistEntryUpdate = useCallback",
  );
  const update = sourceSlice(
    source,
    "const persistEntryUpdate = useCallback",
    "const syncFromServer = useCallback",
  );
  const deletion = sourceSlice(
    source,
    "const deleteEntry = useCallback",
    "const updateEntry = useCallback",
  );

  for (const mutation of [pushDoc, create, update, deletion]) {
    assert.match(mutation, /authIdentityBoundary\.captureSignedIn\(\)/);
    assert.match(mutation, /authIdentityBoundary\.canContinue\(authPermit\)/);
  }
  assert.match(source, /authorizedEntryMutationRef\.current\.get\(entry\)/);
  assert.match(
    source,
    /authorizedEntryMutationRef\.current\.get\(localEntry\)/,
  );
  assert.match(
    source,
    /authorizedEntryMutationRef\.current\.set\(pendingEntry/,
  );
  assert.match(source, /authorizedEntryMutationRef\.current\.set\(merged/);
  assert.match(
    deletion,
    /else if \(authPermit\) \{[\s\S]*deletionLedgerIds\.push\(realId\)[\s\S]*for \(const discardedId of deletionLedgerIds\)[\s\S]*await markServerEntryDiscarded\(discardedId, dataScopeAtStart\)/,
  );
});

test("Care cleanup tombstones are identity-scoped before reset persistence or retry", () => {
  const source = readFileSync(CARE_CONTEXT_PATH, "utf8");
  const cleanup = sourceSlice(
    source,
    "const markServerEntryDiscarded = useCallback",
    "if (!entryUpdateQueueRef.current)",
  );
  const reset = sourceSlice(
    source,
    "const persistCareResetCleanupIntent = useCallback",
    "const finalizeSuccessfulCareReset = useCallback",
  );

  assert.match(cleanup, /replaceCareCleanupLedgerScope\(/);
  assert.match(cleanup, /dataScope/);
  assert.match(reset, /scopeCareCleanupEntryIds\(/);
  assert.match(reset, /persistCareCleanupLedger\(scopedCleanupLedger\)/);
});
