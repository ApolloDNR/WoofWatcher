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
  assert.doesNotMatch(pick, /setDraft|setPhase|setTimeout|setInterval|suggest/i);
  assert.doesNotMatch(save, /sourceUri/);
  assert.doesNotMatch(screen, /AsyncStorage|FileSystem|copyAsync|saveAvatarSet|uploadAsync|fetch\(/i);
  assert.doesNotMatch(screen, /\bPhase\b|setPhase|scanLine|finishTimer|lineTimer|scanLoop|pulseLoop/);
  assert.equal(callCount(screen, "saveAvatarConfig"), 1);
  assert.equal(callCount(screen, "resetAvatarConfig"), 1);
});

test("backward-reads old v1 config and rewrites only clean v1 objects on Save or Reset", () => {
  const model = read(PATHS.model);
  const context = read(PATHS.context);
  const load = between(context, "const load = async", "const getAvatarSource = useCallback");
  const save = between(context, "const saveAvatarConfig = useCallback", "const resetAvatarConfig = useCallback");
  const reset = between(context, "const resetAvatarConfig = useCallback", "const hasCustomAvatar");

  assert.match(context, /const AVATAR_CONFIG_KEY = "woofwatcher\.petAvatarConfig\.v1"/);
  assert.match(context, /const AVATAR_KEY = "woofwatcher\.avatarSet\.v1"/);
  assert.match(load, /normalizeAvatarConfig\(JSON\.parse\(rawConfig\), "Phoenix"\)/);
  assert.doesNotMatch(load, /AsyncStorage\.setItem\(AVATAR_CONFIG_KEY/);
  assert.match(save, /const clean = normalizeAvatarConfig/);
  assert.match(save, /AsyncStorage\.setItem\(AVATAR_CONFIG_KEY, JSON\.stringify\(clean\)\)/);
  assert.match(reset, /const clean = createDefaultAvatarConfig\(petName\)/);
  assert.match(reset, /AsyncStorage\.setItem\(AVATAR_CONFIG_KEY, JSON\.stringify\(clean\)\)/);
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
