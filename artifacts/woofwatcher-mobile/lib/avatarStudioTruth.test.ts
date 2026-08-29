import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(join(process.cwd(), "artifacts", "woofwatcher-mobile"))
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();

const PATHS = {
  screen: join(MOBILE_ROOT, "components", "more", "AvatarStudioScreen.tsx"),
  careTeam: join(MOBILE_ROOT, "components", "more", "CareTeamSuppliesScreen.tsx"),
  more: join(MOBILE_ROOT, "app", "(tabs)", "more.tsx"),
  pack: join(MOBILE_ROOT, "app", "(tabs)", "pack.tsx"),
  model: join(MOBILE_ROOT, "lib", "avatarStudio.ts"),
  breed: join(MOBILE_ROOT, "lib", "breedTemplateMatch.ts"),
  context: join(MOBILE_ROOT, "context", "AvatarContext.tsx"),
  localData: join(MOBILE_ROOT, "lib", "avatarLocalDataReset.ts"),
} as const;

function read(path: string): string {
  assert.equal(existsSync(path), true, `missing truth input: ${path}`);
  return readFileSync(path, "utf8");
}

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `missing start anchor: ${start}`);
  assert.notEqual(endAt, -1, `missing end anchor: ${end}`);
  return source.slice(startAt, endAt);
}

function callCount(source: string, name: string): number {
  return source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0;
}

test("removes analyzer-shaped Avatar runtime state and copy", () => {
  const screen = read(PATHS.screen);
  const model = read(PATHS.model);
  const context = read(PATHS.context);

  for (const [path, source] of [
    [PATHS.screen, screen],
    [PATHS.model, model],
    [PATHS.context, context],
  ] as const) {
    for (const token of [
      "scanAssisted",
      "AvatarScanSuggestion",
      "buildTemplateScanSuggestion",
      "detectedTraits",
    ]) {
      assert.doesNotMatch(source, new RegExp(`\\b${token}\\b`), `${path}: ${token}`);
    }
  }

  for (const [path, source] of [
    [PATHS.screen, screen],
    [PATHS.model, model],
  ] as const) {
    assert.doesNotMatch(source, /\bconfidence\b/i, `${path}: confidence`);
    assert.doesNotMatch(source, /\bscan(?:ning)?\b/i, `${path}: scan language`);
    assert.doesNotMatch(source, /AVATAR_SCAN_WORKFLOW_STEPS|AvatarScanWorkflow/);
    assert.doesNotMatch(
      source,
      /Suggested starting traits|PixelLab template match|Provider scanning|automatic detection|WoofWatcher will suggest/i,
    );
  }
});

test("keeps a picked photo local, ephemeral, and unable to mutate the draft", () => {
  const screen = read(PATHS.screen);
  const pick = between(screen, "const pick = async", "const selectTemplate =");
  const save = between(screen, "const saveDraft = async", "const resetDraft = async");

  assert.match(screen, /type StudioTab = "reference" \| "template" \| "customize" \| "emotes"/);
  assert.match(screen, /Photo reference/);
  assert.match(screen, /Local only/);
  assert.match(screen, /does not analyze it/i);
  assert.match(screen, /Selected reference photo/);
  assert.match(screen, /Current manual pixel twin/);
  assert.match(pick, /setSourceUri\(res\.assets\[0\]\.uri\)/);
  assert.match(pick, /appFileSystem\.runProtectedPicker/);
  assert.match(pick, /appFileSystem\.isIntentCurrent\(intent\)/);
  const captureAt = pick.indexOf("captureIntent()");
  const protectedPickerAt = pick.indexOf("runProtectedPicker(");
  const permissionAt = pick.indexOf("ensurePermission(camera)");
  const currentCheckAt = pick.indexOf("isIntentCurrent(intent)");
  const cameraLaunchAt = pick.indexOf("launchCameraAsync(");
  const libraryLaunchAt = pick.indexOf("launchImageLibraryAsync(");
  assert.ok(
    [
      captureAt,
      protectedPickerAt,
      permissionAt,
      currentCheckAt,
      cameraLaunchAt,
      libraryLaunchAt,
    ].every((index) => index >= 0),
    "Avatar protected picker sequence must be present",
  );
  assert.ok(
    captureAt < protectedPickerAt &&
      protectedPickerAt < permissionAt &&
      permissionAt < currentCheckAt &&
      currentCheckAt < cameraLaunchAt &&
      currentCheckAt < libraryLaunchAt,
    "Avatar must capture intent before the protected permission await and re-check it before either native picker can launch",
  );
  assert.doesNotMatch(pick, /setDraft|setPhase|setTimeout|setInterval|suggest/i);
  assert.doesNotMatch(save, /sourceUri/);
  assert.doesNotMatch(screen, /AsyncStorage|copyAsync|persistPickedMedia|saveAvatarSet|uploadAsync|fetch\(/i);
  assert.doesNotMatch(screen, /\bPhase\b|setPhase|scanLine|finishTimer|lineTimer|scanLoop|pulseLoop/);
  assert.equal(callCount(screen, "saveAvatarConfig"), 1);
  assert.equal(callCount(screen, "resetAvatarConfig"), 1);
});

test("Avatar Studio reports picker, removal, save, and reset failures without lying about state", () => {
  const screen = read(PATHS.screen);
  const pick = between(screen, "const pick = async", "const removeReferencePhoto = async");
  const remove = between(screen, "const removeReferencePhoto = async", "const selectTemplate =");
  const save = between(screen, "const saveDraft = async", "const resetDraft = async");
  const reset = between(screen, "const resetDraft = async", "return (");

  assert.match(
    screen,
    /import\s*\{[^}]*\bnotifyDialog\b[^}]*\}\s*from\s*"@\/lib\/confirmDialog"/s,
  );
  assert.match(pick, /permissionDenied = true/);
  assert.match(pick, /Permission needed/);
  assert.match(pick, /catch \(error\)/);
  assert.match(pick, /Photo unavailable/);
  assert.match(remove, /sourceUriRef\.current = null/);
  assert.match(remove, /setSourceUri\(null\)/);
  assert.match(remove, /await releasePickedMediaReferences/);
  assert.match(remove, /cleanup\.status === "partial-failure"/);
  assert.match(remove, /Photo cleanup incomplete/);
  assert.match(save, /try \{/);
  assert.match(save, /catch/);
  assert.match(save, /Avatar not saved/);
  assert.match(reset, /try \{/);
  assert.match(reset, /catch/);
  assert.match(reset, /Avatar not reset/);
  assert.ok(
    reset.indexOf("await resetAvatarConfig(petName)") < reset.indexOf("setDraft(clean)"),
    "Reset must commit durable storage before showing the clean draft",
  );
  assert.match(screen, /actionDisabled=\{avatarEditorDisabled\}/);
  assert.match(screen, /disabled=\{avatarEditorDisabled\}/);
  assert.match(screen, /onPress=\{\(\) => void removeReferencePhoto\(\)\}/);
});

test("Avatar Studio freezes every persisted draft mutator during a pending save or reset", () => {
  const screen = read(PATHS.screen);
  for (const [start, end] of [
    ["const selectTemplate =", "const setAccessory ="],
    ["const setAccessory =", "const selectStudioTab ="],
    ["const setCoatColor =", "const setFaceMarking ="],
    ["const setFaceMarking =", "const previewMoodState ="],
  ] as const) {
    assert.match(
      between(screen, start, end),
      /if \(!avatarIsLoaded \|\| avatarPersistenceInFlightRef\.current\) return;/,
      `${start} must reject an edit while persistence is in flight`,
    );
  }
  assert.ok(
    (screen.match(/accessibilityState=\{\{ disabled: avatarEditorDisabled \}\}/g)
      ?.length ?? 0) >= 6,
    "all four editor groups plus Save and Reset must expose their disabled state",
  );
  assert.match(screen, /avatarDraftDirtyRef = useRef\(false\)/);
  assert.match(screen, /shouldSyncAvatarStudioDraftFromContext/);
  assert.match(screen, /draftDirty: avatarDraftDirtyRef\.current/);
  assert.match(screen, /backDisabled=\{avatarPersistenceBusy\}/);
  assert.match(screen, /isLoaded: avatarIsLoaded/);
  assert.match(screen, /const avatarEditorDisabled = !avatarIsLoaded \|\| avatarPersistenceBusy/);
  assert.match(screen, /Loading saved avatar choices/);
  assert.ok(
    (screen.match(/avatarDraftDirtyRef\.current = true/g)?.length ?? 0) >= 4,
    "every persisted editor group must mark the visible draft dirty",
  );
});

test("backward-reads old v1 config and rewrites only clean v1 objects on Save or Reset", () => {
  const model = read(PATHS.model);
  const context = read(PATHS.context);
  const localData = read(PATHS.localData);
  const load = between(
    context,
    "useEffect(() => {\n    let cancelled = false;",
    "const getAvatarSource = useCallback",
  );
  const save = between(context, "const saveAvatarConfig = useCallback", "const resetAvatarConfig = useCallback");
  const reset = between(context, "const resetAvatarConfig = useCallback", "const hasCustomAvatar");

  assert.match(localData, /AVATAR_CONFIG_KEY = "woofwatcher\.petAvatarConfig\.v1"/);
  assert.match(localData, /AVATAR_KEY = "woofwatcher\.avatarSet\.v1"/);
  assert.doesNotMatch(context, /const AVATAR_(?:CONFIG_)?KEY\s*=/);
  assert.match(
    load,
    /normalizeAvatarConfig\(\s*JSON\.parse\(raw(?:Config)?\),\s*DEFAULT_PET_PLACEHOLDER,?\s*\)/,
  );
  assert.doesNotMatch(load, /AsyncStorage/);
  assert.match(save, /const clean = normalizeAvatarConfig/);
  assert.match(
    save,
    /removableStorage\.setItem\(\s*AVATAR_CONFIG_KEY,\s*JSON\.stringify\(clean\),?\s*\)/,
  );
  assert.match(reset, /const clean = createDefaultAvatarConfig\(petName\)/);
  assert.match(
    reset,
    /removableStorage\.setItem\(\s*AVATAR_CONFIG_KEY,\s*JSON\.stringify\(clean\),?\s*\)/,
  );
  assert.match(context, /hasManualAvatarConfiguration\(avatarConfig\)/);
  assert.match(model, /export function hasManualAvatarConfiguration\(/);
});

test("removes consumer claims while truth-reading More, Pack, and landed Care Team", () => {
  const sources = [PATHS.more, PATHS.pack, PATHS.careTeam, PATHS.breed] as const;
  for (const path of sources) {
    assert.doesNotMatch(read(path), /scan-assisted/i, path);
  }

  const more = read(PATHS.more);
  assert.match(more, /sub: "Create a pixel care twin with manual choices"/);
  assert.match(more, /\{avatarTemplate\.label\} care twin/);
  assert.doesNotMatch(more, /avatarConfig\.scanAssisted/);

  const breed = read(PATHS.breed);
  assert.match(
    breed,
    /hasConfiguredAvatar — any non-default manual template, color, marking,\s*\*\s*accessory, or emote choice/,
  );
});
