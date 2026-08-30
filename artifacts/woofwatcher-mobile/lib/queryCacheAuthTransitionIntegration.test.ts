import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const mobileRoot = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const read = (...segments: string[]) =>
  readFileSync(join(mobileRoot, ...segments), "utf8");

test("the shipping AppFrame is synchronously gated by auth and exact Care scope", () => {
  const layout = read("app", "_layout.tsx");
  const boundary = read("components", "QueryCacheAuthIdentityBoundary.tsx");
  const care = read("context", "CareContext.tsx");

  assert.match(layout, /const queryClient = new QueryClient\(\);/);
  assert.match(
    layout,
    /function AppFrame\(\) \{\s*return \(\s*<QueryCacheAuthIdentityBoundary>\s*<PersonalAppFrame \/>\s*<\/QueryCacheAuthIdentityBoundary>\s*\);\s*\}/,
  );
  assert.match(
    boundary,
    /const \{\s*identityScopeKey,\s*identityScopeStatus,\s*initialSyncStatus,\s*storageWarning,\s*retryIdentityScope,\s*retryInitialSync,\s*retryLocalHydration,?\s*\}\s*=\s*useCare\(\);/,
  );
  assert.match(
    boundary,
    /const authTransition = observeAuthDataScopeKey\(identityScopeKey\);/,
  );
  assert.match(boundary, /useLayoutEffect\(\(\) => \{/);
  assert.match(
    boundary,
    /confirmAuthTransitionObserversHidden\(authTransition\.revision\)/,
  );
  assert.match(
    boundary,
    /authTransition\.status === "admitted" && identityScopeReady/,
  );
  assert.match(
    boundary,
    /\(identityScopeStatus\.state === "local" \|\|[\s\S]*identityScopeStatus\.state === "resolved"\)[\s\S]*initialSyncStatus\.isSettled/,
  );
  assert.match(boundary, /Retry securing account data/);
  assert.match(boundary, /Retry account check/);
  assert.match(boundary, /Retry care refresh/);
  assert.match(boundary, /Retry loading local care data/);
  assert.match(boundary, /WoofWatcher update required/);
  assert.match(boundary, /CARE_READ_ONLY_MESSAGE/);
  assert.match(
    boundary,
    /const futureSchemaBlocked = storageWarning === "newer-version"/,
  );
  assert.match(boundary, /identityScopeStatus\.message/);
  assert.match(boundary, /initialSyncStatus\.message/);
  assert.match(
    boundary,
    /accessibilityRole="alert"[\s\S]*accessibilityLabel=\{`\$\{title\}\. \$\{message\}`\}/,
  );
  assert.match(boundary, /void retryAuthTransition\(\)\.catch\(\(\) => \{/);
  assert.match(boundary, /retryInitialSync\(\);/);
  assert.match(boundary, /retryLocalHydration\(\);/);
  assert.match(care, /identityScopeKey: string \| null;/);
  assert.match(care, /identityScopeStatus: CareIdentityScopeStatus;/);
  assert.match(care, /retryIdentityScope: \(\) => void;/);
  assert.match(care, /initialSyncStatus: CareInitialSyncStatus;/);
  assert.match(care, /retryInitialSync: \(\) => void;/);
  assert.match(care, /retryLocalHydration: \(\) => void;/);
  assert.match(
    care,
    /const currentHydrationReadFailed =[\s\S]*storageWarning === "read-failed"[\s\S]*localHydrationFailure\?\.dataScope === authIdentity\.dataScope[\s\S]*localHydrationFailure\.generation ===[\s\S]*hydrationAttemptGenerationRef\.current/,
  );
  assert.match(
    care,
    /const visibleStorageWarning = currentScopeLoaded[\s\S]*\? storageWarning[\s\S]*: currentHydrationReadFailed[\s\S]*\? "read-failed"[\s\S]*: null/,
  );
  assert.match(
    care,
    /localHydrationFailure\?\.dataScope !== currentDataScope[\s\S]*localHydrationFailure\.generation !==[\s\S]*hydrationAttemptGenerationRef\.current/,
  );
  assert.match(
    care,
    /authIdentity\.phase === "signed-in" \? authIdentity\.identityKey : null/,
  );
});

test("the auth identity recovery gate keeps its only action reachable at large text", () => {
  const boundary = read("components", "QueryCacheAuthIdentityBoundary.tsx");

  assert.match(
    boundary,
    /<ScrollView[\s\S]*style=\{styles\.root\}[\s\S]*contentContainerStyle=\{\[[\s\S]*styles\.content/,
  );
  assert.match(
    boundary,
    /content:\s*\{[\s\S]*flexGrow:\s*1[\s\S]*justifyContent:\s*"center"/,
  );
  assert.match(boundary, /retryButton:\s*\{[\s\S]*paddingVertical:\s*\d+/);
  assert.match(
    boundary,
    /retryText:\s*\{[\s\S]*flexShrink:\s*1[\s\S]*textAlign:\s*"center"/,
  );
});

test("the query owner drains admitted provider mutations between two query cancellations before clear", () => {
  const context = read("context", "QueryCacheLocalDataResetContext.tsx");
  const controller = read("lib", "queryCacheLocalDataReset.ts");

  assert.match(context, /drainTrackedLocalDataWork/);
  assert.match(context, /drainMutations: drainTrackedLocalDataWork/);
  assert.match(
    context,
    /queryClient\.cancelQueries\(undefined, \{\s*revert: true,\s*silent: true,?\s*\}\)/,
  );
  assert.match(
    context,
    /clearQueryAndMutationCaches: \(\) => queryClient\.clear\(\)/,
  );
  assert.match(
    controller,
    /await invokeAsync\(adapters\.cancelQueries\);[\s\S]*await invokeAsync\(adapters\.drainMutations\);[\s\S]*await invokeAsync\(adapters\.cancelQueries\);[\s\S]*adapters\.clearQueryAndMutationCaches\(\);/,
  );
  assert.match(
    controller,
    /authTransitionRequiresDataScope\(expectedIdentity\)[\s\S]*expectedIdentity\.dataScopeKey === null[\s\S]*updateSnapshot\("loading"/,
  );
});

test("joining closes A before direct transport and resumes only fresh household resolution", () => {
  const care = read("context", "CareContext.tsx");
  const query = read("context", "QueryCacheLocalDataResetContext.tsx");
  const operation = read("lib", "householdOperation.ts");
  const careTeam = read("components", "more", "CareTeamSuppliesScreen.tsx");
  const submitJoin = careTeam.match(
    /const submitJoin = \(\) => \{[\s\S]*?\n  \};\n\n  const submitRename/,
  )?.[0];

  assert.match(care, /beginCareHouseholdTransition:/);
  assert.match(care, /resumeCareHouseholdTransition:/);
  assert.match(
    care,
    /if \(!householdTransitionController\.canResolveHousehold\(\)\) return;/,
  );
  assert.match(query, /prepareHouseholdTransition:/);
  assert.match(
    operation,
    /preparing = prepareQueryTransition\(captured\.identityKey\);[\s\S]*await preparing;[\s\S]*runTrackedTransport\(\(\) =>[\s\S]*joinTransport\(inviteCode, captured\.householdId\)/,
  );
  assert.match(
    operation,
    /finally \{[\s\S]*resumeCareTransition\(careToken\)[\s\S]*controller\.complete\(operationToken, notice\)/,
  );
  assert.ok(submitJoin, "the join callback must remain statically inspectable");
  assert.match(
    submitJoin,
    /runHouseholdJoinOperation\(\{[\s\S]*beginCareTransition: beginCareHouseholdTransition,[\s\S]*prepareQueryTransition: prepareHouseholdTransition,[\s\S]*runTrackedTransport:[\s\S]*joinTransport:[\s\S]*joinHousehold\(/,
  );
  assert.match(
    submitJoin,
    /"X-WoofWatcher-Expected-Household-Id": expectedHouseholdId/,
  );
  assert.doesNotMatch(
    submitJoin,
    /refreshMe\(\)|\brefresh\(\)|invalidateQueries|refetchQueries|\.mutateAsync\(/,
  );
});

test("generated personal query keys stay untouched; runtime admission owns isolation", () => {
  const generated = read(
    "..",
    "..",
    "lib",
    "api-client-react",
    "src",
    "generated",
    "api.ts",
  );
  assert.match(generated, /export const getGetMeQueryKey = \(\) =>/);
  assert.doesNotMatch(generated, /authTransition|identityScopeKey/);
});
