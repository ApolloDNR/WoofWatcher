import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../context/CareContext.tsx", import.meta.url),
  "utf8",
);

test("CareContext fences complete history with lifecycle, mutation, and pending-delete generations", () => {
  assert.match(source, /entryMutationGenerationRef/);
  assert.match(source, /pendingCareEntryDeleteIdsRef/);
  assert.match(source, /runCompleteCareEntryHistoryRefresh/);
  assert.match(source, /listCareEntryHistory/);
  assert.match(source, /const syncHouseholdId\s*=\s*syncScope\.householdId/);
  assert.match(
    source,
    /runCompleteCareEntryHistoryRefresh<\s*Entry,\s*CareLifecycleToken\s*>\(\{[\s\S]*householdId:\s*syncHouseholdId/,
  );
  assert.match(
    source,
    /readMutationGeneration:\s*\(\)\s*=>\s*entryMutationGenerationRef\.current/,
  );
  assert.match(
    source,
    /readPendingDeleteIds:\s*\(\)\s*=>\s*pendingCareEntryDeleteIdsRef\.current/,
  );
  assert.match(
    source,
    /entriesRef\.current\s*=\s*committedEntries[\s\S]*setEntries\(committedEntries\)/,
  );
});

test("every local mutation, identity bind, and Task 6 settlement advances the history fence", () => {
  const advanceCalls =
    source.match(/advanceEntryMutationGeneration\(\)/g)?.length ?? 0;
  assert.ok(
    advanceCalls >= 10,
    `expected explicit create/update/delete/bind/success/failure/conflict fences, saw ${advanceCalls}`,
  );

  for (const anchor of [
    "onSynced:",
    "onFailed:",
    "onConflict:",
    "realIdByTemp.current.set(tempId, real.id)",
    "const addEntry = useCallback",
    "const deleteEntry = useCallback",
    "const updateEntry = useCallback",
  ]) {
    const start = source.indexOf(anchor);
    assert.ok(start >= 0, `missing ${anchor}`);
    assert.match(
      source.slice(start, start + 2_400),
      /advanceEntryMutationGeneration\(\)/,
      `${anchor} can change care entries without invalidating a paged snapshot`,
    );
  }
});

test("unbound temp deletes persist their clientKey and clean up a later server twin", () => {
  assert.match(
    source,
    /pendingCareEntryDeleteKeys:\s*pendingCareEntryDeleteKeys/,
    "pending delete intents must survive a device restart",
  );
  assert.match(
    source,
    /parsed\?\.pendingCareEntryDeleteKeys/,
    "hydration must restore pending delete clientKeys before sync",
  );

  const deleteStart = source.indexOf("const deleteEntry = useCallback");
  assert.ok(deleteStart >= 0);
  const deleteBlock = source.slice(deleteStart, deleteStart + 4_200);
  assert.match(
    deleteBlock,
    /addPendingCareEntryDeleteKey\(pendingDeleteKey\)/,
    "an unbound temp delete must be fenced before returning locally",
  );

  const createStart = source.indexOf("const persistEntryCreate = useCallback");
  assert.ok(createStart >= 0);
  const createBlock = source.slice(createStart, createStart + 6_500);
  assert.match(
    createBlock,
    /pendingCareEntryDeleteIdsRef\.current\.has\(tempId\)/,
  );
  assert.match(
    createBlock,
    /deleteCareEntry\(real\.id,\s*\{\s*householdId:\s*createHouseholdId,?\s*\}\)/,
  );
  assert.match(
    createBlock,
    /isCareEntryDeleteConfirmedAbsent\(\s*error,\s*createHouseholdId,?\s*\)/,
  );
  assert.match(createBlock, /removePendingCareEntryDeleteKeys/);
});

test("signed-in deletes durably write the scoped tombstone before hiding or returning success", () => {
  const deleteStart = source.indexOf("const deleteEntry = useCallback");
  assert.ok(deleteStart >= 0);
  const deleteBlock = source.slice(deleteStart, deleteStart + 5_500);
  const writeAhead = deleteBlock.indexOf(
    "await commitCarePendingDeleteMutationIfCurrent",
  );
  const durableAdd = deleteBlock.indexOf(
    "pendingCareEntryDeleteStore.add(",
    writeAhead,
  );
  const localRemoval = deleteBlock.indexOf("const nextEntries =", durableAdd);
  const tempSuccess = deleteBlock.indexOf(
    'if (realId.startsWith("temp_")) return true',
    durableAdd,
  );
  assert.ok(
    writeAhead >= 0 && durableAdd >= writeAhead,
    "delete must await its dedicated write-ahead store through the scope-fenced commit helper",
  );
  assert.ok(
    durableAdd < localRemoval,
    "the entry cannot disappear before its tombstone is durable",
  );
  assert.ok(
    durableAdd < tempSuccess,
    "a temp delete cannot report success before its tombstone is durable",
  );
  assert.match(
    deleteBlock,
    /catch[\s\S]*setStorageWarning\("save-failed"\)[\s\S]*return false/,
  );
});

test("device wipe drains pending-delete writes before storage removal and clears its cache", () => {
  const wipeStart = source.indexOf("const eraseAllLocalData = useCallback");
  assert.ok(wipeStart >= 0);
  const wipeBlock = source.slice(wipeStart, wipeStart + 7_000);
  const drain = wipeBlock.indexOf(
    "await pendingCareEntryDeleteStore.waitForWrites()",
  );
  const enumerate = wipeBlock.indexOf("await AsyncStorage.getAllKeys()");
  const remove = wipeBlock.indexOf("await AsyncStorage.multiRemove(owned)");
  const forget = wipeBlock.indexOf(
    "pendingCareEntryDeleteStore.forget()",
    remove,
  );
  assert.ok(drain >= 0 && drain < enumerate);
  assert.ok(enumerate < remove && remove < forget);
});

test("only a successful complete snapshot can plan delete cleanup", () => {
  const syncStart = source.indexOf("const syncFromServer = useCallback");
  assert.ok(syncStart >= 0);
  const syncBlock = source.slice(syncStart, syncStart + 14_000);

  const fetchStart = syncBlock.indexOf("fetchPage:");
  const mergeStart = syncBlock.indexOf("mergeEntries:");
  const commitStart = syncBlock.indexOf("commitEntries:");
  const cleanupPlan = syncBlock.indexOf("planPendingCareEntryDeleteCleanup(");
  assert.ok(fetchStart >= 0 && mergeStart > fetchStart);
  assert.ok(commitStart > mergeStart);
  assert.ok(
    cleanupPlan > commitStart,
    "cleanup candidates must be scoped to the snapshot that actually commits",
  );
  assert.doesNotMatch(
    syncBlock.slice(fetchStart, mergeStart),
    /pendingServerDeletesForCommit\.set/,
  );
  assert.match(
    syncBlock,
    /pendingCareEntryDeleteIdsRef\.current\.has\(pendingKey\)[\s\S]*pendingCareEntryDeleteIdsRef\.current\.has\(serverId\)/,
  );
  assert.match(
    syncBlock,
    /deleteCareEntry\(serverId,\s*\{\s*householdId:\s*syncHouseholdId,?\s*\}\)/,
  );
});

test("every awaited tombstone mutation rechecks the captured scope before caller continuation", () => {
  const helperCalls = [
    ...source.matchAll(/await commitCarePendingDeleteMutationIfCurrent\(\{/g),
  ].map((match) => match.index);
  assert.equal(
    helperCalls.length,
    9,
    "every Task 7 tombstone path must use the helper",
  );
  helperCalls.forEach((start, index) => {
    const nextHelper = helperCalls[index + 1] ?? source.length;
    const freshGuard = source.indexOf("if (!isCurrentRequest()) return", start);
    assert.ok(
      freshGuard > start && freshGuard < nextHelper,
      `tombstone helper ${index + 1} must recheck scope before caller continuation`,
    );
  });

  const syncStart = source.indexOf("const syncFromServer = useCallback");
  const cleanupAdd = source.indexOf(
    "addPendingCareEntryDeleteKey(serverId)",
    syncStart,
  );
  const mapping = source.indexOf(
    "realIdByTemp.current.set(pendingKey, serverId)",
    cleanupAdd,
  );
  assert.match(
    source.slice(cleanupAdd, mapping + 500),
    /realIdByTemp\.current\.set\(pendingKey,\s*serverId\);[\s\S]*advanceEntryMutationGeneration\(\);[\s\S]*\},/,
    "mapping a cleanup id and advancing its snapshot fence must be one atomic commit",
  );

  const deleteStart = source.indexOf("const deleteEntry = useCallback");
  const restore = source.indexOf("if (removed)", deleteStart);
  const lastStoreMutation = source.lastIndexOf(
    "await commitCarePendingDeleteMutationIfCurrent",
    restore,
  );
  assert.match(
    source.slice(lastStoreMutation, restore + 1_000),
    /commit:\s*\(\)\s*=>\s*\{[\s\S]*removePendingCareEntryDeleteKeys\(realId\);[\s\S]*const restoredEntries\s*=\s*\[[\s\S]*entriesRef\.current\.filter\([\s\S]*entriesRef\.current\s*=\s*restoredEntries;[\s\S]*setEntries\(restoredEntries\);[\s\S]*advanceEntryMutationGeneration\(\);[\s\S]*\}/,
    "tombstone removal, deduped restore, and generation advance must be one synchronous commit",
  );
});
