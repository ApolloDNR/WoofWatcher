import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const careContextSource = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "context",
    "CareContext.tsx",
  ),
  "utf8",
);

function sourceSlice(start: string, end: string): string {
  const startIndex = careContextSource.indexOf(start);
  const endIndex = careContextSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return careContextSource.slice(startIndex, endIndex);
}

test("CareContext serializes primary snapshots and keeps owner wipe barriers ordered", () => {
  assert.match(
    careContextSource,
    /import \{[\s\S]*createCarePersistenceWriter[\s\S]*\} from "@\/lib\/carePersistenceWriter";/,
  );
  assert.match(
    careContextSource,
    /createCarePersistenceWriter<CarePersistenceSnapshot>\(/,
  );
  assert.match(careContextSource, /carePersistenceWriter\s*\.enqueue\(\{/);
  assert.equal(
    careContextSource.match(
      /AsyncStorage\.setItem\(CARE_PRIMARY_LOCAL_DATA_KEY,/g,
    )?.length,
    1,
  );
  const wipe = sourceSlice(
    "const performOwnerWipe = useCallback(async () => {",
    "const eraseAllLocalData = useCallback(() => {",
  );
  const paused = wipe.indexOf("snapshotPersistencePausedRef.current = true;");
  const invalidated = wipe.indexOf(
    "await carePersistenceWriter.invalidateAndDrain();",
  );
  const removed = wipe.indexOf("await AsyncStorage.multiRemove(owned);");
  const nativeFilesRemoved = wipe.indexOf("FileSystem.deleteAsync(");
  const defaultRefInstalled = wipe.indexOf("docRef.current = defaultDoc;");
  const hydrationCompleted = wipe.indexOf("hydratedRef.current = true;");
  const resumed = wipe.indexOf("snapshotPersistencePausedRef.current = false;");

  assert.ok(paused >= 0);
  assert.ok(paused < invalidated);
  assert.ok(invalidated < removed);
  assert.ok(removed < nativeFilesRemoved);
  assert.ok(nativeFilesRemoved < defaultRefInstalled);
  assert.ok(defaultRefInstalled < hydrationCompleted);
  assert.ok(hydrationCompleted < resumed);
  assert.match(
    careContextSource,
    /if \(eraseAllLocalDataInFlightRef\.current\) \{\s*return eraseAllLocalDataInFlightRef\.current;/,
  );
  const hydration = sourceSlice(
    "const hydrationEraseGeneration = eraseGenerationRef.current;",
    "// Persist the offline cache whenever synced state changes.",
  );

  assert.match(
    hydration,
    /eraseGenerationRef\.current === hydrationEraseGeneration/,
  );
  assert.ok(
    (hydration.match(/hydrationCanContinue\(\)/g)?.length ?? 0) >= 4,
  );
  assert.match(hydration, /if \(!hydrationCanContinue\(\)\) return;/);
});

test("CareContext pauses snapshot enqueue during prepare without skipping accepted physical writes", () => {
  const physicalPrimaryWrite = sourceSlice(
    "createCarePersistenceWriter<CarePersistenceSnapshot>(",
    "const carePersistenceWriter = carePersistenceWriterRef.current;",
  );
  assert.doesNotMatch(physicalPrimaryWrite, /snapshotPersistencePausedRef/);

  const persistence = sourceSlice(
    "// Persist the offline cache whenever synced state changes.",
    "const pushDoc = useCallback",
  );
  assert.match(
    persistence,
    /!isWriteAdmissionOpen\(\)/,
  );
  assert.match(persistence, /operationSettledEpoch/);
});

test("CareContext supplies nondestructive prepare drains and commit-only invalidation", () => {
  const hooks = sourceSlice(
    "createCareLocalDataResetController({",
    "const careLocalDataResetController =",
  );

  assert.match(
    hooks,
    /canPrepare:\s*\(\) =>\s*hydratedRef\.current && !legacyOwnerWipeInProgressRef\.current/,
  );
  assert.match(
    hooks,
    /drainPrimarySnapshots:\s*\(\) => carePersistenceWriter\.drain\(\)/,
  );
  assert.match(
    hooks,
    /drainCleanupLedger:\s*\(\) => discardedServerEntryWriter\.drain\(\)/,
  );
  assert.match(
    hooks,
    /invalidateAndDrainPrimarySnapshots:\s*\(\) =>\s*carePersistenceWriter\.invalidateAndDrain\(\)/,
  );
  assert.match(hooks, /persistCleanupIntent:\s*persistCareResetCleanupIntent/);
  assert.match(hooks, /finalizeSuccessfulCommit:\s*finalizeSuccessfulCareReset/);
  assert.match(hooks, /endCommit:\s*endCoordinatedCareReset/);
});
