import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const mobileRoot = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const careContextSource = readFileSync(
  join(mobileRoot, "context", "CareContext.tsx"),
  "utf8",
);
const avatarContextSource = readFileSync(
  join(mobileRoot, "context", "AvatarContext.tsx"),
  "utf8",
);
const avatarResetSource = readFileSync(
  join(mobileRoot, "lib", "avatarLocalDataReset.ts"),
  "utf8",
);
const privacySource = readFileSync(
  join(mobileRoot, "components", "more", "PrivacyDataScreen.tsx"),
  "utf8",
);

function sourceSlice(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Care attaches the required owner while root admission blocks only new mutations", () => {
  assert.match(
    careContextSource,
    /import \{ useLocalDataReset \} from "@\/context\/LocalDataResetContext";/,
  );
  assert.match(
    careContextSource,
    /attachRequiredParticipant,[\s\S]*isWriteAdmissionOpen,[\s\S]*operationSettledEpoch,[\s\S]*removableStorage,[\s\S]*= useLocalDataReset\(\);/,
  );
  assert.match(
    careContextSource,
    /attachRequiredParticipant\(\s*"care",\s*careLocalDataResetController\.participant,?\s*\)/,
  );

  const admission = sourceSlice(
    careContextSource,
    "const careDocWritesBlocked = useCallback(",
    "// Maps optimistic temp ids",
  );
  const continuation = sourceSlice(
    careContextSource,
    "const careWriteCanContinue = useCallback(",
    "// Maps optimistic temp ids",
  );
  assert.match(admission, /!isWriteAdmissionOpen\(\)/);
  assert.doesNotMatch(continuation, /isWriteAdmissionOpen/);
});

test("Care prepare drains accepted specialized work and commit alone invalidates it", () => {
  const controllerHooks = sourceSlice(
    careContextSource,
    "createCareLocalDataResetController({",
    "const careLocalDataResetController =",
  );

  assert.match(
    controllerHooks,
    /canPrepare:\s*\(\) =>\s*hydratedRef\.current && !legacyOwnerWipeInProgressRef\.current/,
  );
  assert.match(
    controllerHooks,
    /drainPrimarySnapshots:\s*\(\) => carePersistenceWriter\.drain\(\)/,
  );
  assert.match(
    controllerHooks,
    /drainCleanupLedger:\s*\(\) => discardedServerEntryWriter\.drain\(\)/,
  );
  assert.match(
    controllerHooks,
    /invalidateAndDrainPrimarySnapshots:\s*\(\) =>\s*carePersistenceWriter\.invalidateAndDrain\(\)/,
  );
  assert.match(controllerHooks, /endCommit:\s*endCoordinatedCareReset/);

  const physicalPrimaryWrite = sourceSlice(
    careContextSource,
    "createCarePersistenceWriter<CarePersistenceSnapshot>(",
    "const carePersistenceWriter = carePersistenceWriterRef.current;",
  );
  assert.match(
    physicalPrimaryWrite,
    /AsyncStorage\.setItem\(CARE_PRIMARY_LOCAL_DATA_KEY, raw\)/,
  );
  assert.doesNotMatch(physicalPrimaryWrite, /snapshotPersistencePausedRef/);

  const beginCommit = sourceSlice(
    careContextSource,
    "const beginCoordinatedCareReset = useCallback(",
    "const endCoordinatedCareReset = useCallback(",
  );
  assert.match(beginCommit, /ownerWipeInProgressRef\.current = true/);
  assert.match(beginCommit, /eraseGenerationRef\.current \+= 1/);
  assert.match(beginCommit, /latestCareSnapshotRef\.current \+= 1/);
  assert.match(beginCommit, /careWriteProtectionRef\.current\.invalidate\(\)/);
  assert.match(beginCommit, /entryUpdateQueue\.cancelAll\(\)/);
  assert.doesNotMatch(beginCommit, /careWriteProtectionRef\.current\.reset\(\)/);
  assert.doesNotMatch(
    beginCommit,
    /futureCareDocRef\.current = null|cancelledTempEntries\.current\.add/,
  );
});

test("Care auxiliary hydration uses the shared lane while primary and cleanup ledger stay specialized", () => {
  const hydration = sourceSlice(
    careContextSource,
    "const hydrationEraseGeneration = eraseGenerationRef.current;",
    "// Persist the offline cache whenever synced state changes.",
  );

  assert.match(
    hydration,
    /persistRecoveryEvidence\(\s*`\$\{CARE_PRIMARY_LOCAL_DATA_KEY\}\.recovery`/,
  );
  assert.match(
    hydration,
    /persistRecoveryEvidence\(\s*`\$\{CARE_PRESERVED_LOCAL_DATA_KEY\}\.recovery`/,
  );
  assert.match(
    hydration,
    /await removableStorage\.setItem\(key, raw\)/,
  );
  assert.match(
    hydration,
    /removableStorage\.getItem\(LEGACY_IMPORT_FLAG_KEY\)/,
  );
  assert.match(hydration, /removableStorage\.getItem\(LEGACY_STATE_KEY\)/);
  assert.match(
    hydration,
    /removableStorage\.setItem\(\s*LEGACY_IMPORT_FLAG_KEY/,
  );
  assert.match(
    hydration,
    /AsyncStorage\.getItem\(CARE_PRIMARY_LOCAL_DATA_KEY\)/,
  );
  assert.match(
    hydration,
    /AsyncStorage\.getItem\(CARE_PRESERVED_LOCAL_DATA_KEY\)/,
  );
});

test("future-schema Care hydration keeps the unknown primary envelope opaque", () => {
  const hydration = sourceSlice(
    careContextSource,
    "const stageCareHydration = async",
    "const applyStagedCareHydration =",
  );
  const primaryStage = sourceSlice(
    hydration,
    "if (raw) {",
    "let legacySummary:",
  );

  assert.match(
    primaryStage,
    /if \(parsed\?\.doc && isFutureCareDocDataVersion\(parsed\.doc\)\) \{[\s\S]*futureDoc = parsed\.doc;[\s\S]*futureRaw = raw;[\s\S]*primaryIsPristine = false;[\s\S]*\} else \{[\s\S]*Array\.isArray\(parsed\?\.entries\)[\s\S]*cachedServerVersion = parsed\.serverVersion;/,
  );
  assert.match(
    hydration,
    /if \(primaryIsPristine\) \{/,
  );
});

test("coordinated exact-key deletion preserves cleanup metadata and finalizes evidence only after primary removal", () => {
  const controllerHooks = sourceSlice(
    careContextSource,
    "createCareLocalDataResetController({",
    "const careLocalDataResetController =",
  );
  assert.match(
    controllerHooks,
    /removeItem:\s*\(key\) => AsyncStorage\.removeItem\(key\)/,
  );
  assert.match(
    controllerHooks,
    /persistCleanupIntent:\s*persistCareResetCleanupIntent/,
  );
  assert.match(
    controllerHooks,
    /finalizeSuccessfulCommit:\s*finalizeSuccessfulCareReset/,
  );

  const cleanupIntent = sourceSlice(
    careContextSource,
    "const persistCareResetCleanupIntent = useCallback(",
    "const finalizeSuccessfulCareReset = useCallback(",
  );
  assert.match(
    cleanupIntent,
    /if \(cleanupLedger\.length > 0\)[\s\S]*discardedServerEntryWriter\.enqueue\(cleanupLedger\)/,
  );
  assert.match(
    cleanupIntent,
    /\.\.\.creatingTempEntries\.current/,
  );
  assert.match(
    cleanupIntent,
    /stagedCareResetTempIdsRef\.current = new Set\(\s*tempIdsNeedingRemoteCleanup,?\s*\)/,
  );
  assert.match(
    cleanupIntent,
    /stagedCareResetCleanupLedgerRef\.current = cleanupLedger/,
  );
  assert.doesNotMatch(cleanupIntent, /enqueue\(null\)/);
  assert.doesNotMatch(cleanupIntent, /cancelledTempEntries\.current\.add/);
  assert.doesNotMatch(
    cleanupIntent,
    /discardedServerEntryIdsRef\.current\s*=/,
  );

  const finalization = sourceSlice(
    careContextSource,
    "const finalizeSuccessfulCareReset = useCallback(",
    "createCareLocalDataResetController({",
  );
  assert.match(finalization, /futureCareDocRef\.current = null/);
  assert.match(finalization, /futureCareCacheRawRef\.current = null/);
  assert.match(finalization, /careWriteProtectionRef\.current\.reset\(\)/);
  assert.match(finalization, /docRef\.current = defaultDoc/);
  assert.match(
    finalization,
    /for \(const tempId of stagedCareResetTempIdsRef\.current\)[\s\S]*cancelledTempEntries\.current\.add\(tempId\)/,
  );
  assert.match(
    finalization,
    /discardedServerEntryIdsRef\.current = new Set\(\s*stagedCareResetCleanupLedgerRef\.current,?\s*\)/,
  );
  assert.doesNotMatch(
    finalization,
    /discardedServerEntryIdsRef\.current\s*=\s*new Set\(\)/,
  );

  const legacyTail = sourceSlice(
    careContextSource,
    "const performOwnerWipe = useCallback(async () => {",
    "const eraseAllLocalData = useCallback(() => {",
  );
  assert.match(legacyTail, /AsyncStorage\.getAllKeys\(\)/);
  assert.match(legacyTail, /AsyncStorage\.multiRemove\(owned\)/);
  assert.match(legacyTail, /FileSystem\.deleteAsync\(/);
});

test("settled reset epochs trigger persistence without rerunning completed hydration", () => {
  const persistence = sourceSlice(
    careContextSource,
    "// Persist the offline cache whenever synced state changes.",
    "const pushDoc = useCallback",
  );
  assert.match(persistence, /!isWriteAdmissionOpen\(\)/);
  assert.match(persistence, /suppressNextSettledSnapshotRef\.current/);
  assert.match(persistence, /operationSettledEpoch/);
  assert.match(
    persistence,
    /getCarePristineSnapshotPersistenceDecision\(\{[\s\S]*current:\s*\{ doc, entries, serverVersion \},[\s\S]*pristine:\s*suppressed,[\s\S]*operationSettledEpoch/,
  );
  assert.match(
    persistence,
    /if \(decision === "wait"\) return;[\s\S]*if \(decision === "suppress"\) return;[\s\S]*carePersistenceWriter\s*\.enqueue/,
  );

  const hydration = sourceSlice(
    careContextSource,
    "// Hydrate instantly from the offline cache",
    "// Persist the offline cache whenever synced state changes.",
  );
  assert.match(
    hydration,
    /if \(hydratedRef\.current\) return;/,
  );
  assert.match(hydration, /operationSettledEpoch/);
  assert.match(
    hydration,
    /careHydrationAttemptAuthorityRef\.current!\.begin\(\s*isWriteAdmissionOpen\(\),?\s*\)/,
  );
  assert.match(
    hydration,
    /hydrationAttempt\.isCurrent\(\)/,
  );
  assert.match(hydration, /cancelled = true/);
  assert.match(hydration, /hydrationAttempt\.cancel\(\)/);
  assert.match(hydration, /clearTimeout\(retryTimer\)/);
  assert.match(
    hydration,
    /const stagedHydration = await stageCareHydration\(/,
  );
  const importedSnapshot = hydration.indexOf(
    "await carePersistenceWriter.enqueue({",
  );
  const importedStamp = hydration.indexOf(
    "await removableStorage.setItem(\n              LEGACY_IMPORT_FLAG_KEY",
  );
  const stagedApply = hydration.indexOf(
    "applyStagedCareHydration(stagedHydration);",
  );
  assert.ok(importedSnapshot >= 0);
  assert.ok(importedSnapshot < importedStamp);
  assert.ok(importedStamp < stagedApply);
  assert.match(
    hydration,
    /if \(!hydrationCanContinue\(\)\) return;[\s\S]*applyStagedCareHydration\(stagedHydration\)/,
  );
});

test("legacy and coordinated Care resets reject overlap while Privacy remains on its explicit legacy bypass", () => {
  const legacy = sourceSlice(
    careContextSource,
    "const eraseAllLocalData = useCallback(() => {",
    "const careMutationsBlocked = careDocWritesBlocked();",
  );
  assert.match(legacy, /if \(!isWriteAdmissionOpen\(\)\)/);
  assert.match(legacy, /Promise\.reject/);
  assert.doesNotMatch(legacy, /careLocalDataResetController\.participant/);

  const hooks = sourceSlice(
    careContextSource,
    "createCareLocalDataResetController({",
    "const careLocalDataResetController =",
  );
  assert.match(
    hooks,
    /canPrepare:\s*\(\) =>\s*hydratedRef\.current && !legacyOwnerWipeInProgressRef\.current/,
  );

  assert.match(
    privacySource,
    /Promise\.all\(\[eraseAllLocalData\(\), clearAvatarSet\(\), resetAvatarConfig\(\)\]\)/,
  );
  assert.doesNotMatch(privacySource, /\brunReset\b/);
});

test("failed coordinated commits recover pending entries while successful commits keep deletion final", () => {
  const ending = sourceSlice(
    careContextSource,
    "const endCoordinatedCareReset = useCallback(",
    "const persistCareResetCleanupIntent = useCallback(",
  );
  assert.match(ending, /\{ committed \}: \{ committed: boolean \}/);
  assert.match(
    ending,
    /if \(\s*!committed &&[\s\S]*hasInterruptedCareEntryMutationsToRecover\(entriesRef\.current\)[\s\S]*\)[\s\S]*recoverInterruptedCareEntryMutations\(\s*entriesRef\.current,?\s*\)/,
  );
  assert.match(ending, /ownerWipeInProgressRef\.current = false/);

  const finalization = sourceSlice(
    careContextSource,
    "const finalizeSuccessfulCareReset = useCallback(",
    "const careLocalDataResetControllerRef =",
  );
  assert.doesNotMatch(finalization, /\bawait\b|\bthrow\b/);
  assert.match(finalization, /suppressNextSettledSnapshotRef\.current = true/);
});

test("Avatar attaches one stable required owner with exact raw commit removal", () => {
  assert.match(
    avatarContextSource,
    /import \{ useLocalDataReset \} from "@\/context\/LocalDataResetContext";/,
  );
  assert.match(
    avatarContextSource,
    /attachRequiredParticipant,[\s\S]*operationSettledEpoch,[\s\S]*removableStorage,[\s\S]*runTrackedLocalDataWork,[\s\S]*= useLocalDataReset\(\);/,
  );
  assert.match(
    avatarContextSource,
    /useRef<AvatarLocalDataResetController \| null>\(null\)/,
  );
  assert.match(
    avatarContextSource,
    /createAvatarLocalDataResetController\(\{[\s\S]*removeItem:\s*\(key\) => AsyncStorage\.removeItem\(key\),[\s\S]*finalizeSuccessfulCommit:/,
  );
  assert.match(
    avatarContextSource,
    /attachRequiredParticipant\(\s*"avatar",\s*avatarLocalDataResetController\.participant,?\s*\)/,
  );
  assert.match(
    avatarContextSource,
    /useEffect\(\s*\(\) =>\s*attachRequiredParticipant\(\s*"avatar",\s*avatarLocalDataResetController\.participant,?\s*\),\s*\[attachRequiredParticipant, avatarLocalDataResetController\],?\s*\)/,
  );
  assert.match(
    avatarContextSource,
    /\[attachRequiredParticipant, avatarLocalDataResetController\]/,
  );
  assert.match(
    avatarContextSource,
    /setAvatarSet\(null\)[\s\S]*setAvatarConfig\(createDefaultAvatarConfig\("Phoenix"\)\)[\s\S]*setIsLoaded\(true\)/,
  );
  const finalizer = sourceSlice(
    avatarContextSource,
    "finalizeSuccessfulCommit: () => {",
    "        },\n      });",
  );
  assert.doesNotMatch(
    finalizer,
    /\bawait\b|\bthrow\b|AsyncStorage|removableStorage/,
  );
  assert.doesNotMatch(avatarResetSource, /multiRemove|getAllKeys|FileSystem|deleteAsync/);
  assert.doesNotMatch(avatarContextSource, /deleteAsync/);
});

test("Avatar hydration and repair stay tracked, cancellable, revision-current, and retryable", () => {
  const hydration = sourceSlice(
    avatarContextSource,
    "useEffect(() => {\n    let cancelled = false;",
    "const getAvatarSource = useCallback",
  );

  assert.match(hydration, /runAvatarHydrationAttempt\(\{/);
  assert.match(
    hydration,
    /drainPendingWrites:\s*removableStorage\.drain/,
  );
  assert.match(hydration, /read:\s*\(\) => removableStorage\.getItem\(AVATAR_KEY\)/);
  assert.match(
    hydration,
    /read:\s*\(\) => removableStorage\.getItem\(AVATAR_CONFIG_KEY\)/,
  );
  assert.match(hydration, /resolve:\s*async \(raw\)[\s\S]*verifyAvatarSet/);
  assert.match(
    hydration,
    /removableStorage\.(?:setItem|removeItem)\(AVATAR_KEY/,
  );
  assert.match(hydration, /avatarSetHydrationRevisionRef\.current/);
  assert.match(hydration, /avatarConfigHydrationRevisionRef\.current/);
  assert.match(hydration, /markAvatarSetLoaded/);
  assert.match(hydration, /markAvatarConfigLoaded/);
  assert.match(hydration, /cancelled/);
  assert.match(hydration, /requestHydrationRetry/);
  assert.match(hydration, /operationSettledEpoch/);
  assert.match(hydration, /hydrationReloadNonce/);
  assert.match(hydration, /\.catch\(/);
  assert.doesNotMatch(hydration, /AsyncStorage\.(?:getItem|setItem|removeItem)/);

  const loaded = sourceSlice(
    hydration,
    "markLoaded: () => {",
    "requestRetry: requestHydrationRetry",
  );
  assert.doesNotMatch(
    loaded,
    /clearTimeout/,
    "a failed superseding mutation owns its scheduled retry even if stale hydration marks loaded",
  );

  const markSetLoaded = sourceSlice(
    avatarContextSource,
    "const markAvatarSetLoaded = useCallback(",
    "const markAvatarConfigLoaded = useCallback(",
  );
  const markConfigLoaded = sourceSlice(
    avatarContextSource,
    "const markAvatarConfigLoaded = useCallback(",
    "useEffect(",
  );
  assert.match(
    markSetLoaded,
    /avatarSetLoadedRef\.current = true[\s\S]*avatarConfigLoadedRef\.current/,
  );
  assert.match(
    markConfigLoaded,
    /avatarConfigLoadedRef\.current = true[\s\S]*avatarSetLoadedRef\.current/,
  );
  assert.doesNotMatch(markSetLoaded, /resetHydrationRetry\(\)/);
  assert.doesNotMatch(markConfigLoaded, /resetHydrationRetry\(\)/);

  assert.match(
    avatarContextSource,
    /useEffect\(\s*\(\) => \{\s*hydrationRetryScheduler\.activate\(\);\s*return \(\) => hydrationRetryScheduler\.deactivate\(\);\s*\},\s*\[hydrationRetryScheduler\],?\s*\)/,
  );
});

test("Avatar public mutations use the removable lane and persist before applying memory", () => {
  const methods = sourceSlice(
    avatarContextSource,
    "const saveAvatarSet = useCallback",
    "const hasCustomAvatar",
  );

  assert.equal(methods.match(/runTrackedAvatarMutation\(\{/g)?.length ?? 0, 4);
  assert.match(
    methods,
    /beginCurrentMutation:\s*\(\) => \{\s*avatarSetHydrationRevisionRef\.current \+= 1;\s*avatarSetLoadedRef\.current = false;\s*setIsLoaded\(false\)/,
  );
  assert.match(
    methods,
    /beginCurrentMutation:\s*\(\) => \{\s*avatarConfigHydrationRevisionRef\.current \+= 1;\s*avatarConfigLoadedRef\.current = false;\s*setIsLoaded\(false\)/,
  );
  assert.match(methods, /removableStorage\.setItem\(AVATAR_KEY/);
  assert.match(methods, /removableStorage\.removeItem\(AVATAR_KEY\)/);
  assert.match(methods, /removableStorage\.setItem\(\s*AVATAR_CONFIG_KEY/);
  assert.doesNotMatch(methods, /AsyncStorage/);
  assert.match(methods, /requestHydrationRetry/);
  assert.match(methods, /markAvatarSetLoaded/);
  assert.match(methods, /markAvatarConfigLoaded/);

  assert.match(
    privacySource,
    /Promise\.all\(\[eraseAllLocalData\(\), clearAvatarSet\(\), resetAvatarConfig\(\)\]\)/,
  );
  assert.doesNotMatch(privacySource, /\brunReset\b/);
});
