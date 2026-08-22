import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const REPO_ROOT = process.cwd();
const MOBILE_ROOT = join(REPO_ROOT, "artifacts", "woofwatcher-mobile");

function readMobile(...segments: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...segments), "utf8");
}

function readRepo(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), "utf8");
}

function recursiveFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

function productionTypeScriptFiles(): string[] {
  return ["app", "components", "constants", "context", "hooks", "lib"]
    .flatMap((directory) => recursiveFiles(join(MOBILE_ROOT, directory)))
    .filter(
      (path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path),
    )
    .sort();
}

function relativeMobile(path: string): string {
  return relative(MOBILE_ROOT, path).replaceAll("\\", "/");
}

test("closes mobile production storage behind the four approved root owners", () => {
  const files = productionTypeScriptFiles();
  const routeBypasses = files
    .filter((path) => /^(app|components)\//.test(relativeMobile(path)))
    .filter((path) => /\b(?:AsyncStorage|localStorage|sessionStorage)\b/.test(readFileSync(path, "utf8")))
    .map(relativeMobile);
  assert.deepEqual(routeBypasses, []);

  const asyncStorageImports = files
    .filter((path) =>
      /from ["']@react-native-async-storage\/async-storage["']/.test(
        readFileSync(path, "utf8"),
      ),
    )
    .map(relativeMobile);
  assert.deepEqual(asyncStorageImports, [
    "context/AvatarContext.tsx",
    "context/CareContext.tsx",
    "context/DevicePreferencesContext.tsx",
    "context/LocalDataResetContext.tsx",
  ]);
});

test("keeps each normal preference literal in the central manifest only", () => {
  const files = productionTypeScriptFiles();
  const expectedOwner = "lib/devicePreferences.ts";

  for (const literal of [
    "woofwatcher.homeWelcomeDismissed.v1",
    "woofwatcher.mobileReleaseQaSession.v1",
    "woofwatcher.packSupplies.v1",
    "woofwatcher.travelBag.v1",
  ]) {
    const owners = files
      .filter((path) => readFileSync(path, "utf8").includes(literal))
      .map(relativeMobile);
    assert.deepEqual(owners, [expectedOwner], `unexpected owners for ${literal}`);
  }

  assert.match(
    readMobile("lib", "mobileQaSession.ts"),
    /export\s*\{\s*MOBILE_QA_SESSION_STORAGE_KEY\s*\}\s*from\s*["']\.\/devicePreferences(?:\.ts)?["']/,
  );
  assert.match(
    readMobile("lib", "packSupplies.ts"),
    /export\s*\{\s*PACK_SUPPLIES_KEY\s*\}\s*from\s*["']\.\/devicePreferences(?:\.ts)?["']/,
  );
  assert.match(
    readMobile("lib", "travelBag.ts"),
    /export\s*\{\s*TRAVEL_BAG_KEY\s*\}\s*from\s*["']\.\/devicePreferences(?:\.ts)?["']/,
  );
});

test("records the legacy PWA and fixture carveouts without widening the mobile store", () => {
  const central = readMobile("lib", "devicePreferences.ts");
  const pwaEntry = readRepo("artifacts", "woofwatcher", "src", "vanilla", "app-entry.js");
  const qaSeed = readMobile("scripts", "qa-seed-populated.mjs");

  assert.match(central, /LEGACY_PWA_THEME_KEY\s*=\s*["']woofwatcher\.v1\.theme["']/);
  assert.match(pwaEntry, /THEME_KEY\s*=\s*["']woofwatcher\.v1\.theme["']/);
  assert.match(
    pwaEntry,
    /NOTIFICATION_SENT_KEY\s*=\s*["']woofwatcher\.v1\.lastNotificationKey["']/,
  );
  assert.doesNotMatch(central, /woofwatcher\.v1\.lastNotificationKey/);
  assert.match(
    qaSeed,
    /localStorage\.setItem\(["']woofwatcher\.homeWelcomeDismissed\.v1["'],\s*["']true["']\)/,
  );

  const directFixtureOwners = recursiveFiles(join(MOBILE_ROOT, "scripts"))
    .filter((path) => /\.[cm]?js$/.test(path))
    .filter((path) =>
      /localStorage\.setItem\(\s*["']woofwatcher\.homeWelcomeDismissed\.v1["']\s*,/.test(
        readFileSync(path, "utf8"),
      ),
    )
    .map(relativeMobile);
  assert.deepEqual(directFixtureOwners, ["scripts/qa-seed-populated.mjs"]);
});

test("mounts one tracked preference store and one identity-safe raw reset owner", () => {
  const context = readMobile("context", "DevicePreferencesContext.tsx");
  const resetOwner = readMobile(
    "lib",
    "devicePreferencesLocalDataReset.ts",
  );
  const layout = readMobile("app", "_layout.tsx");

  assert.match(context, /useLocalDataReset\(\)/);
  assert.match(context, /removableStorage/);
  assert.match(context, /operationSettledEpoch/);
  assert.match(context, /runTrackedLocalDataWork/);
  assert.match(context, /attachRequiredParticipant/);
  assert.match(
    context,
    /const storeRef = useRef<DevicePreferencesStore \| null>\(null\);/,
  );
  assert.match(
    context,
    /if \(storeRef\.current === null\) \{\s*storeRef\.current = createDevicePreferencesStore\(\s*removableStorage,\s*\{\s*runTrackedHydration:\s*runTrackedLocalDataWork,\s*\},?\s*\);\s*\}/,
  );
  assert.doesNotMatch(context, /useRef\(createDevicePreferencesStore\(/);
  assert.match(
    context,
    /const devicePreferencesLocalDataResetControllerRef\s*=\s*useRef<DevicePreferencesLocalDataResetController \| null>\(null\);/,
  );
  assert.match(
    context,
    /if \(devicePreferencesLocalDataResetControllerRef\.current === null\) \{\s*devicePreferencesLocalDataResetControllerRef\.current\s*=\s*createDevicePreferencesLocalDataResetController\(\{\s*removeItem:\s*\(key\)\s*=>\s*AsyncStorage\.removeItem\(key\),?\s*\}\);\s*\}/,
  );
  assert.doesNotMatch(
    context,
    /useRef\(createDevicePreferencesLocalDataResetController\(/,
  );
  assert.match(
    context,
    /useEffect\(\s*\(\)\s*=>\s*attachRequiredParticipant\(\s*["']device-preferences["'],\s*devicePreferencesLocalDataResetController\.participant,?\s*\),\s*\[attachRequiredParticipant,\s*devicePreferencesLocalDataResetController\],?\s*\);/,
  );
  assert.doesNotMatch(
    context,
    /(?:getAllKeys|multiRemove|\.clear\(|AsyncStorage\.(?:getItem|setItem)|removableStorage\.removeItem)/,
  );
  assert.doesNotMatch(
    resetOwner,
    /(?:AsyncStorage|removableStorage|getAllKeys|multiRemove|\.clear\(|\.getItem\(|\.setItem\(|finalize|setWelcomeDismissed|setQa|setSupplies|setTravelBag)/,
  );

  const resetOpen = layout.indexOf("<LocalDataResetProvider>");
  const preferencesOpen = layout.indexOf("<DevicePreferencesProvider>");
  const auth = layout.indexOf("<AuthBridge />");
  const careOpen = layout.indexOf("<CareProvider>");
  const avatarOpen = layout.indexOf("<AvatarProvider>");
  const preferencesClose = layout.indexOf("</DevicePreferencesProvider>");
  const resetClose = layout.indexOf("</LocalDataResetProvider>");
  for (const [name, index] of [
    ["LocalDataResetProvider", resetOpen],
    ["DevicePreferencesProvider", preferencesOpen],
    ["AuthBridge", auth],
    ["CareProvider", careOpen],
    ["AvatarProvider", avatarOpen],
    ["DevicePreferencesProvider close", preferencesClose],
    ["LocalDataResetProvider close", resetClose],
  ] as const) {
    assert.ok(index >= 0, `missing ${name}`);
  }
  assert.ok(resetOpen < preferencesOpen);
  assert.ok(preferencesOpen < auth);
  assert.ok(auth < careOpen);
  assert.ok(careOpen < avatarOpen);
  assert.ok(avatarOpen < preferencesClose);
  assert.ok(preferencesClose < resetClose);
});

test("migrates Home, QA, More, and Supplies normal I/O to the shared store", () => {
  const home = readMobile("app", "(tabs)", "index.tsx");
  const qa = readMobile("app", "care-twin-qa.tsx");
  const more = readMobile("app", "(tabs)", "more.tsx");
  const supplies = readMobile(
    "components",
    "more",
    "CareTeamSuppliesScreen.tsx",
  );

  for (const [name, source] of [
    ["Home", home],
    ["QA", qa],
    ["More", more],
    ["Supplies", supplies],
  ] as const) {
    assert.match(source, /useDevicePreferences/ , `${name} does not consume the store`);
    assert.doesNotMatch(source, /\bAsyncStorage\b/);
  }

  assert.match(home, /store\s*\.\s*hydrate\(HOME_WELCOME_DISMISSED_KEY/);
  assert.match(home, /store\s*\.\s*save\(HOME_WELCOME_DISMISSED_KEY,\s*["']true["']\)/);
  assert.match(home, /LocalDataResetInProgressError/);

  assert.match(qa, /store\s*\.\s*hydrate\(MOBILE_QA_SESSION_STORAGE_KEY/);
  assert.match(qa, /store\s*\.\s*save\(MOBILE_QA_SESSION_STORAGE_KEY/);
  assert.match(qa, /LocalDataResetInProgressError/);

  assert.match(more, /store\s*\.\s*hydrate\(MOBILE_QA_SESSION_STORAGE_KEY/);
  assert.match(more, /LocalDataResetInProgressError/);

  assert.match(supplies, /store\s*\.\s*hydrate\(PACK_SUPPLIES_KEY/);
  assert.match(supplies, /store\s*\.\s*hydrate\(TRAVEL_BAG_KEY/);
  assert.match(supplies, /store\s*\.\s*save\(PACK_SUPPLIES_KEY/);
  assert.match(supplies, /store\s*\.\s*save\(TRAVEL_BAG_KEY/);
  assert.match(
    supplies,
    /setSupplies\(\(current\)\s*=>\s*\{[\s\S]*const next = removeItem\(current, item\.id\);[\s\S]*store\s*\.\s*save\(\s*PACK_SUPPLIES_KEY,[\s\S]*serializeSupplies\(next\)/,
  );
  assert.match(supplies, /LocalDataResetInProgressError/);
});

test("mounted preference projections follow reset epochs and bounded retry lifetimes", () => {
  const home = readMobile("app", "(tabs)", "index.tsx");
  const qa = readMobile("app", "care-twin-qa.tsx");
  const more = readMobile("app", "(tabs)", "more.tsx");
  const supplies = readMobile(
    "components",
    "more",
    "CareTeamSuppliesScreen.tsx",
  );

  for (const [name, source] of [
    ["Home", home],
    ["QA", qa],
    ["More", more],
    ["Supplies", supplies],
  ] as const) {
    assert.match(source, /operationSettledEpoch/, `${name} ignores reset settlement`);
    assert.match(
      source,
      /createDevicePreferenceHydrationRetryScheduler/,
      `${name} lacks bounded hydration retry`,
    );
    assert.match(source, /hydrationRetry\.activate\(\)/, `${name} does not activate retry`);
    assert.match(source, /hydrationRetry\.deactivate\(\)/, `${name} leaks retry after cleanup`);
  }

  assert.doesNotMatch(
    home,
    /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,260}setWelcomeDismissed\(false\)/,
  );
  assert.match(home, /hydrationRetry\.request\(hydrateWelcomePreference\)/);

  assert.match(more, /useFocusEffect/);
  assert.match(more, /hydrationRetry\.request\(hydrateQaProof\)/);
  assert.doesNotMatch(
    more,
    /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,420}setSavedNativeQaSummary\(null\)/,
  );

  assert.match(qa, /createMobileQaSessionPersistenceGate/);
  assert.match(qa, /createEmptyMobileQaSessionState/);
  assert.match(qa, /applyHydrationIfCurrent/);
  assert.match(qa, /consumeAutosaveDecision/);
  assert.match(qa, /qaEditAdmissionRef\.current/);
  assert.match(qa, /qaSessionPersistenceGate\.markRealEdit\(\)/);
  assert.match(
    qa,
    /hydrationRetry\.request\(hydrateQaSessionWhenAutosaveAdmitted\)/,
  );
  for (const setter of [
    "setQaStatusById",
    "setQaNotes",
    "setQaEvidenceById",
    "setSurfaceStatusById",
    "setSurfaceNotes",
    "setSurfaceEvidenceById",
  ]) {
    assert.match(qa, new RegExp(`${setter}FromHydration`));
    assert.match(qa, new RegExp(`const ${setter}[^=]*=`));
  }

  assert.match(supplies, /hydrateSupplies\(\);\s*hydrateTravelBag\(\);/);
  assert.match(
    supplies,
    /if \(suppliesHydrated && travelBagHydrated\)\s*\{\s*hydrationRetry\.reset\(\)/,
  );
  assert.doesNotMatch(
    supplies,
    /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,260}setSupplies\(parseSupplies\(null\)\)/,
  );
  assert.doesNotMatch(
    supplies,
    /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,260}setTravelBag\(defaultTravelBag\(\)\)/,
  );
});

test("Privacy deletion uses the coordinated root and no preference/avatar bypass", () => {
  const privacy = readMobile("components", "more", "PrivacyDataScreen.tsx");

  assert.match(privacy, /useLocalDataReset\(\)/);
  assert.match(privacy, /runPrivacyLocalDataReset\(runReset\)/);
  assert.doesNotMatch(
    privacy,
    /Promise\.all|eraseAllLocalData|clearAvatarSet|resetAvatarConfig/,
  );
});
