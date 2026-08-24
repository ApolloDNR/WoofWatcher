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

test("CareContext serializes primary snapshots and exposes only coordinated reset barriers", () => {
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
      /removableStorage\.setItem\(CARE_PRIMARY_LOCAL_DATA_KEY,/g,
    )?.length,
    1,
  );
  assert.doesNotMatch(
    careContextSource,
    /AsyncStorage\.setItem\(CARE_PRIMARY_LOCAL_DATA_KEY,/,
  );
  const finalization = sourceSlice(
    "const finalizeSuccessfulCareReset = useCallback(() => {",
    "const careLocalDataResetControllerRef =",
  );
  assert.match(finalization, /docRef\.current = defaultDoc/);
  assert.match(finalization, /hydratedRef\.current = true/);
  assert.match(finalization, /suppressNextSettledSnapshotRef\.current = true/);
  assert.doesNotMatch(
    careContextSource,
    /eraseAllLocalData|performOwnerWipe|AsyncStorage\.(?:getAllKeys|multiRemove)|FileSystem\.deleteAsync/,
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

test("CareContext exposes an exact current-ref persistence receipt for file cleanup", () => {
  assert.match(
    careContextSource,
    /persistCurrentCareSnapshot:\s*\(\)\s*=>\s*Promise<boolean>/,
  );
  const receipt = sourceSlice(
    "const persistCurrentCareSnapshot = useCallback(",
    "// Persist the offline cache whenever synced state changes.",
  );
  assert.match(receipt, /doc:\s*docRef\.current/);
  assert.match(receipt, /entries:\s*entriesRef\.current/);
  assert.match(receipt, /serverVersion:\s*versionRef\.current/);
  assert.match(receipt, /await carePersistenceWriter\.enqueue/);
  assert.match(receipt, /careWriteCanContinue\(writeGeneration\)/);

  const effect = sourceSlice(
    "// Persist the offline cache whenever synced state changes.",
    "const pushDoc = useCallback",
  );
  assert.match(effect, /persistCurrentCareSnapshot\(\)/);
  assert.doesNotMatch(effect, /JSON\.stringify\(\{\s*doc,\s*entries/);
});

test("CareContext supplies nondestructive prepare drains and commit-only invalidation", () => {
  const hooks = sourceSlice(
    "createCareLocalDataResetController({",
    "const careLocalDataResetController =",
  );

  assert.match(
    hooks,
    /canPrepare:\s*\(\) => hydratedRef\.current/,
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
