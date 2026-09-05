import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("More editor scopes require the exact Care revision, pet, and provider household", async () => {
  const module = await import("./moreEditorScope.ts").catch(() => null);
  assert.ok(module, "the More editor scope helper must exist");

  const profileFingerprint = module.createMoreEditorSourceFingerprint({
    name: "Phoenix",
    breed: "Shepherd mix",
  });
  const captured = {
    careScopeRevision: 7,
    activePetId: "dog-a",
    providerHouseholdId: "household-a",
    careReady: true,
    sourceFingerprint: profileFingerprint,
  };
  assert.equal(module.isSameMoreEditorScope(captured, captured), true);
  assert.equal(
    module.isSameMoreEditorScope(captured, {
      ...captured,
      careScopeRevision: 8,
    }),
    false,
  );
  assert.equal(
    module.isSameMoreEditorScope(captured, {
      ...captured,
      activePetId: "dog-b",
    }),
    false,
  );
  assert.equal(
    module.isSameMoreEditorScope(captured, {
      ...captured,
      providerHouseholdId: "household-b",
    }),
    false,
  );
  assert.equal(
    module.isSameMoreEditorScope(captured, {
      ...captured,
      careReady: false,
    }),
    false,
  );
  assert.equal(
    module.isSameMoreEditorScope(captured, {
      ...captured,
      sourceFingerprint: module.createMoreEditorSourceFingerprint({
        name: "Phoenix",
        breed: "Retriever mix",
      }),
    }),
    false,
  );
});

test("More source fingerprints ignore object key order but detect semantic replacement", async () => {
  const { createMoreEditorSourceFingerprint } =
    await import("./moreEditorScope.ts");
  assert.equal(
    createMoreEditorSourceFingerprint({
      name: "Phoenix",
      weight: { unit: "lb", current: 60 },
    }),
    createMoreEditorSourceFingerprint({
      weight: { current: 60, unit: "lb" },
      name: "Phoenix",
    }),
  );
  assert.notEqual(
    createMoreEditorSourceFingerprint({ name: "Phoenix", weight: 60 }),
    createMoreEditorSourceFingerprint({ name: "Phoenix", weight: 61 }),
  );
});

test("recognizes only an explicit provider household conflict", async () => {
  const { isHouseholdScopeConflict } = await import("./moreEditorScope.ts");

  assert.equal(isHouseholdScopeConflict({ status: 409 }), true);
  assert.equal(isHouseholdScopeConflict({ status: 403 }), false);
  assert.equal(isHouseholdScopeConflict(new Error("409")), false);
  assert.equal(isHouseholdScopeConflict(null), false);
});

test("every More draft captures and verifies its exact scope before mutation", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "app",
      "(tabs)",
      "more.tsx",
    ),
    "utf8",
  );

  assert.match(source, /careScopeRevision,[\s\S]*?\} = useCare\(\)/);
  assert.match(
    source,
    /currentMoreEditorScopeRef\.current = buildCurrentMoreEditorScope/,
  );
  assert.match(source, /isSameMoreEditorScope/);
  assert.match(source, /createMoreEditorSourceFingerprint/);
  assert.match(
    source,
    /const captureMoreEditorScope = [\s\S]*?if \(!isLoaded\)[\s\S]*?return false/,
    "opening an editor while Care is not authoritative must fail closed",
  );

  const contracts = [
    ["openFuturePetSheet", "saveFuturePet", "future-pet"],
    ["openAccessPassSheet", "saveAccessPassDraft", "access-pass"],
    ["openProfileEdit", "saveProfile", "profile"],
    ["openDietEdit", "saveDiet", "diet"],
    ["openProviderSetup", "saveProviderSetup", "provider"],
    ["openJoinHousehold", "submitJoin", "join"],
    ["openRenameHousehold", "submitRename", "rename"],
    ["openDisplayName", "submitName", "display-name"],
  ] as const;

  for (const [openHandler, saveHandler, editorId] of contracts) {
    const openStart = source.indexOf(`const ${openHandler} =`);
    const openEnd = source.indexOf("\n  };", openStart);
    assert.ok(
      openStart > 0 && openEnd > openStart,
      `${openHandler} must exist`,
    );
    assert.match(
      source.slice(openStart, openEnd),
      new RegExp(`captureMoreEditorScope\\(\"${editorId}\"\\)`),
    );

    const saveStart = source.indexOf(`const ${saveHandler} =`);
    const saveEnd = source.indexOf("\n  };", saveStart);
    assert.ok(
      saveStart > 0 && saveEnd > saveStart,
      `${saveHandler} must exist`,
    );
    assert.match(
      source.slice(saveStart, saveEnd),
      new RegExp(
        `if \\(!moreEditorScopeIsCurrent\\(\"${editorId}\"\\)\\) return;`,
      ),
    );
  }

  assert.match(
    source,
    /useEffect\(\(\) => \{[\s\S]*?activeMoreEditorScopeRef\.current[\s\S]*?setProfileOpen\(false\)[\s\S]*?setDietEditOpen\(false\)[\s\S]*?setProviderSetupOpen\(false\)/,
    "scope changes must dismiss every stale draft even before its save control is tapped",
  );
});

test("household rename carries its captured household through the provider request", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "artifacts",
      "woofwatcher-mobile",
      "app",
      "(tabs)",
      "more.tsx",
    ),
    "utf8",
  );

  assert.match(
    source,
    /updateHousehold as updateHouseholdRequest/,
    "rename must call the generated provider request with per-submit scope",
  );
  assert.match(
    source,
    /"x-woofwatcher-household-id": expectedHouseholdId/,
    "the provider mutation must send the captured household id",
  );

  const submitStart = source.indexOf("const submitRename =");
  const submitEnd = source.indexOf("\n  };", submitStart);
  assert.ok(
    submitStart > 0 && submitEnd > submitStart,
    "submitRename must exist",
  );
  const submitRename = source.slice(submitStart, submitEnd);
  assert.match(
    submitRename,
    /activeMoreEditorScopeRef\.current\?\.scope\.providerHouseholdId/,
  );
  assert.match(
    submitRename,
    /expectedHouseholdId/,
    "the request must use the scope captured when rename opened",
  );
  assert.match(
    submitRename,
    /currentMoreEditorScopeRef\.current\.providerHouseholdId\s*!==\s*expectedHouseholdId/,
    "a stale response must not close or refresh the replacement household",
  );
  assert.match(
    submitRename,
    /onError:\s*\(error\)[\s\S]*isHouseholdScopeConflict\(error\)[\s\S]*activeMoreEditorScopeRef\.current = null[\s\S]*setRenameOpen\(false\)[\s\S]*refreshMe\(\)[\s\S]*refresh\(\)/,
    "a 409 must close the stale editor and force both identity and Care household reverification",
  );
});
