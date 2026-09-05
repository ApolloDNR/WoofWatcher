import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const avatarContext = readFileSync(
  new URL("../context/AvatarContext.tsx", import.meta.url),
  "utf8",
);
const careContext = readFileSync(
  new URL("../context/CareContext.tsx", import.meta.url),
  "utf8",
);

test("Care exposes Avatar only to a verified owner-household-dog scope", () => {
  assert.match(careContext, /avatarStorageScope/);
  assert.match(
    careContext,
    /householdScopeVerifiedRef\.current[\s\S]*storageHouseholdIdRef\.current/,
  );
  assert.match(careContext, /activePetId/);
});

test("Avatar synchronously remounts a keyed storage session when Care scope changes", () => {
  assert.match(
    avatarContext,
    /const \{ avatarStorageScope[\s\S]*\} = useCare\(\)/,
  );
  assert.match(
    avatarContext,
    /<AvatarProviderSession[\s\S]*key=\{avatarStorageSessionKey\}[\s\S]*scope=\{avatarStorageScope\}/,
  );
  assert.match(
    avatarContext,
    /createAvatarPersistence\(\{[\s\S]*scope[\s\S]*storage: AsyncStorage/,
  );
  const activation = avatarContext.indexOf("avatarPersistence?.activate()");
  const hydration = avatarContext.indexOf("const load = async () =>");
  assert.notEqual(activation, -1, "Avatar persistence lease must be activated");
  assert.ok(
    activation < hydration,
    "the lifecycle lease must activate before the hydration effect starts",
  );
  assert.match(avatarContext, /avatarPersistence\?\.deactivate\(\)/);
});

test("Avatar keeps Privacy mounted while a Care scope is temporarily unavailable and masks the prior dog", () => {
  assert.match(
    avatarContext,
    /const retainedAvatarStorageSessionKeyRef = useRef<string \| null>\(null\)/,
  );
  assert.match(
    avatarContext,
    /retainedAvatarStorageSessionKeyRef\.current \?\? "unavailable"/,
  );
  assert.doesNotMatch(
    avatarContext,
    /`unavailable\.\$\{careScopeRevision\}`/,
    "a temporary Care loading revision must not unmount the active Privacy screen",
  );
  assert.match(
    avatarContext,
    /const visibleAvatarSet = scopeAvailable \? avatarSet : null;/,
  );
  assert.match(
    avatarContext,
    /const visibleHydrationStatus = scopeAvailable[\s\S]*?: "loading";/,
  );
  assert.match(
    avatarContext,
    /if \(!scopeAvailable\) \{\s*avatarPersistence\?\.deactivate\(\);\s*return;/,
  );
  assert.match(
    avatarContext,
    /!scopeAvailable \|\|[\s\S]*?avatarHydrationStatusRef\.current !== "ready"/,
    "writes must fail closed while the exact Avatar scope is unavailable",
  );
});

test("Avatar config writes expose an exact synchronous generation fence to Setup", () => {
  assert.match(avatarContext, /createAvatarConfigWriteGate/);
  assert.match(
    avatarContext,
    /avatarConfigWriteRevision: avatarConfigWriteState\.revision/,
  );
  assert.match(
    avatarContext,
    /avatarConfigWritePending: avatarConfigWriteState\.pending/,
  );
  assert.match(avatarContext, /getAvatarConfigWriteState/);
  assert.match(
    avatarContext,
    /avatarConfigWriteGate\.beginIfCurrent\(expectedRevision\)/,
  );
  assert.match(
    avatarContext,
    /finally \{\s*avatarConfigWriteGate\.finish\(reservation\);\s*publishAvatarConfigWriteState\(\);/,
    "the pending flag must clear for both storage success and failure",
  );
  assert.match(avatarContext, /saveAvatarConfigIfCurrent/);
});

test("same-scope Avatar reactivation hydrates against the latest synchronous attempt", () => {
  assert.match(
    avatarContext,
    /const attempt = hydrationAttemptRef\.current;/,
    "erase advances the ref without the retry state, so same-scope reactivation must capture the ref itself",
  );
  assert.doesNotMatch(avatarContext, /const attempt = hydrationAttempt;/);
});

test("a signed-in owner erase keeps Avatar sealed until household reverification completes", () => {
  const eraseStart = careContext.indexOf(
    "const eraseAllLocalData = useCallback",
  );
  const eraseEnd = careContext.indexOf(
    "const hydrationStatus: CareHydrationStatus",
    eraseStart,
  );
  const erase = careContext.slice(eraseStart, eraseEnd);

  assert.match(
    erase,
    /const householdReverificationRequired = signedInRef\.current;/,
    "the post-wipe state must distinguish an authenticated provider session from a local-only session",
  );
  assert.match(
    erase,
    /persistencePausedRef\.current = householdReverificationRequired;[\s\S]*householdScopeChangingRef\.current = householdReverificationRequired;[\s\S]*setHouseholdScopeChanging\(householdReverificationRequired\);/,
    "the same household must stay masked until the fresh provider sync publishes its verified scope",
  );
  assert.doesNotMatch(
    erase,
    /persistencePausedRef\.current = false;[\s\S]{0,160}householdScopeChangingRef\.current = false;/,
    "erase completion cannot briefly expose an unverified null Avatar scope",
  );

  const verifiedScope = careContext.slice(
    careContext.indexOf("householdScopeVerifiedRef.current = true"),
    careContext.indexOf("const avatarStorageScope"),
  );
  assert.match(
    verifiedScope,
    /householdScopeVerifiedRef\.current = true;[\s\S]*persistencePausedRef\.current = false;[\s\S]*householdScopeChangingRef\.current = false;[\s\S]*setHouseholdScopeChanging\(false\);/,
    "a successful same-household refresh must reopen the exact Avatar scope",
  );
});
