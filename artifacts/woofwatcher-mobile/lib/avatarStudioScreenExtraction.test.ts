import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const COMPONENT_PATH = join(
  MOBILE_ROOT,
  "components",
  "more",
  "AvatarStudioScreen.tsx",
);
const PORTRAIT_ROUTE_PATH = join(MOBILE_ROOT, "app", "portrait.tsx");
const ROUTER_PATH = join(MOBILE_ROOT, "components", "more", "MoreSectionRouter.tsx");

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function callCount(source: string, name: string): number {
  return source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0;
}

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `missing start anchor: ${start}`);
  assert.notEqual(endAt, -1, `missing end anchor: ${end}`);
  return source.slice(startAt, endAt);
}

test("moves Avatar Studio mechanically into one dual-surface owner", () => {
  assert.equal(
    existsSync(COMPONENT_PATH),
    true,
    "AvatarStudioScreen.tsx must exist before Portrait delegates",
  );
  const component = read(COMPONENT_PATH);

  assert.match(component, /export interface AvatarStudioScreenProps\s*\{/);
  assert.match(component, /surface:\s*"standalone"\s*\|\s*"tabbed"/);
  assert.match(component, /onBack:\s*\(\)\s*=>\s*void/);
  assert.match(component, /onOpenSpriteQa:\s*\(\)\s*=>\s*void/);
  assert.match(
    component,
    /export default function AvatarStudioScreen\(\{\s*surface,\s*onBack,\s*onOpenSpriteQa,?\s*\}:\s*AvatarStudioScreenProps\)/,
  );
  assert.equal(component.match(/<BoardRouteHeader\b/g)?.length ?? 0, 1);
  assert.equal(component.match(/<ScrollView\b/g)?.length ?? 0, 1);
  assert.match(component, /title="Avatar Studio"/);
  assert.match(component, /subtitle="Choose a pixel twin, then customize\."/);
  assert.match(component, /onBack=\{onBack\}/);
  assert.match(
    component,
    /const openAvatarSpriteProductionQa = \(\) => \{[\s\S]{0,180}Haptics\.selectionAsync\(\)[\s\S]{0,120}onOpenSpriteQa\(\)/,
  );
  assert.match(component, /onPress=\{openAvatarSpriteProductionQa\}/);
  assert.doesNotMatch(component, /useRouter|router\.(?:push|replace)|pathname:\s*"\/care-twin-qa"/);
});

test("preserves the Avatar state, art, picker, motion, and creator anatomy", () => {
  const component = read(COMPONENT_PATH);

  for (const anchor of [
    "activeTab",
    "draft",
    "previewEmote",
    "sourceUri",
    "savedToast",
    "setNow",
    "ImagePicker",
    "AVATAR_TEMPLATES",
    "AVATAR_ACCESSORIES",
    "AVATAR_EMOTE_STATES",
    "SpriteSheetPlayer",
    "LivingPhoenixRoom",
    "buildAvatarSpriteProductionQaSummary",
    "buildAvatarSpriteProductionTemplateReview",
    "useReducedMotion",
    "MIN_MOBILE_TOUCH_TARGET",
    "MOBILE_INLINE_HIT_SLOP",
  ]) {
    assert.match(component, new RegExp(`\\b${anchor}\\b`), `${anchor} must survive the move`);
  }
  assert.match(component, /requestCameraPermissionsAsync/);
  assert.match(component, /requestMediaLibraryPermissionsAsync/);
  assert.match(component, /launchCameraAsync/);
  assert.match(component, /launchImageLibraryAsync/);
  assert.match(component, /if \(res\.canceled \|\| !res\.assets\?\.\[0\]\?\.uri\) return/);
  assert.match(component, /Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Medium\)/);
  assert.equal(component.match(/\buseEffect\(/g)?.length ?? 0, 3);
  assert.equal(component.match(/\bAnimated\.loop\(/g)?.length ?? 0, 1);
  assert.equal(component.match(/\.stop\(\)/g)?.length ?? 0, 1);
  assert.equal(component.match(/\bclearInterval\(/g)?.length ?? 0, 1);
  assert.equal(component.match(/\bclearTimeout\(/g)?.length ?? 0, 0);
  assert.equal(component.match(/\.setValue\(0\)/g)?.length ?? 0, 1);

  const pick = between(component, "const pick = async", "const selectTemplate =");
  assert.match(component, /type StudioTab = "reference" \| "template" \| "customize" \| "emotes"/);
  assert.match(component, /Photo reference/);
  assert.match(component, /Local only/);
  assert.match(component, /Selected reference photo/);
  assert.match(component, /Current manual pixel twin/);
  assert.match(pick, /setSourceUri\(res\.assets\[0\]\.uri\)/);
  assert.doesNotMatch(pick, /setDraft|setPhase|setTimeout|setInterval|suggest/i);
  assert.doesNotMatch(component, /\bPhase\b|setPhase|scanLine|finishTimer|lineTimer|scanLoop|pulseLoop/);
  assert.doesNotMatch(component, /AvatarScanSuggestion|buildTemplateScanSuggestion|detectedTraits|\bconfidence\b/);
});

test("keeps Avatar persistence separate and preserves Save and Reset ordering", () => {
  const component = read(COMPONENT_PATH);

  assert.equal(callCount(component, "saveAvatarConfig"), 1);
  assert.equal(callCount(component, "resetAvatarConfig"), 1);
  for (const careMutation of ["addEntry", "updateEntry", "deleteEntry", "updateCareDoc"]) {
    assert.equal(callCount(component, careMutation), 0, `${careMutation} must not enter Avatar Studio`);
  }
  assert.doesNotMatch(component, /AsyncStorage/);
  assert.match(
    component,
    /await saveAvatarConfig\([\s\S]{0,240}Haptics\.notificationAsync\(Haptics\.NotificationFeedbackType\.Success\)/,
  );
  assert.match(
    component,
    /const clean = createDefaultAvatarConfig\(petName\)[\s\S]{0,240}await resetAvatarConfig\(petName\)[\s\S]{0,160}Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/,
  );
});

test("selects route padding and floating feedback only from surface", () => {
  const component = read(COMPONENT_PATH);

  assert.match(component, /getRouteTopPadding/);
  assert.match(component, /getStandaloneRouteBottomPadding/);
  assert.match(component, /getTabbedRouteBottomPadding/);
  assert.match(component, /getFloatingFeedbackBottomOffset/);
  assert.match(component, /surface,\s*\}/);
  assert.match(component, /surface === "tabbed"/);
  assert.match(component, /insets\.bottom \+ 22/);
});

test("keeps Portrait as one small replace-only bridge and moves focused QA navigation to the router", () => {
  const route = read(PORTRAIT_ROUTE_PATH);
  const router = read(ROUTER_PATH);

  assert.ok(route.length <= 1_400, `Portrait delegate should stay small, received ${route.length} chars`);
  assert.match(route, /useLocalSearchParams/);
  assert.match(route, /resolveCanonicalDestination/);
  assert.match(route, /pathname:\s*"\/portrait"/);
  assert.match(route, /<Redirect\s+href=\{redirectHref\}\s*\/>/);
  assert.doesNotMatch(route, /AvatarStudioScreen|surface="standalone"|useRouter|router\.|care-twin-qa|qaSurface/);
  assert.doesNotMatch(route, /ImagePicker|useAvatar|setInterval|Animated|StyleSheet|saveAvatarConfig|resetAvatarConfig/);
  assert.match(router, /<AvatarStudioScreen\s+surface="tabbed"[\s\S]{0,240}onOpenSpriteQa=\{openSpriteQa\}/);
  assert.match(router, /pathname:\s*"\/care-twin-qa"/);
  assert.match(router, /qaSurface:\s*"avatar-sprite-production-review"/);
});

test("leaves Avatar model, context keys, and registries as the persistence owners", () => {
  const context = read(join(MOBILE_ROOT, "context", "AvatarContext.tsx"));
  const localData = read(join(MOBILE_ROOT, "lib", "avatarLocalDataReset.ts"));
  const model = read(join(MOBILE_ROOT, "lib", "avatarStudio.ts"));
  const assets = read(join(MOBILE_ROOT, "lib", "avatarTemplateAssets.ts"));
  const sprites = read(join(MOBILE_ROOT, "lib", "avatarTemplateSpriteAssets.ts"));

  assert.match(localData, /woofwatcher\.avatarSet\.v1/);
  assert.match(localData, /woofwatcher\.petAvatarConfig\.v1/);
  assert.match(context, /AVATAR_KEY/);
  assert.match(context, /AVATAR_CONFIG_KEY/);
  assert.doesNotMatch(context, /woofwatcher\.(?:avatarSet|petAvatarConfig)\.v1/);
  assert.match(context, /normalizeAvatarConfig/);
  assert.match(model, /createDefaultAvatarConfig/);
  assert.match(model, /normalizeAvatarConfig/);
  assert.match(assets, /getAvatarTemplateDisplaySource/);
  assert.match(sprites, /getAvatarTemplateSpritePreview/);
});
