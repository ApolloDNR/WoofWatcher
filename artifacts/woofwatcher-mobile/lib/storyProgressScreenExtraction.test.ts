import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { resolveMoreSectionRoute } from "./moreSectionRouting.ts";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const COMPONENT_PATH = join(
  MOBILE_ROOT,
  "components",
  "more",
  "StoryProgressScreen.tsx",
);
const STORY_ROUTE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "story.tsx");
const ROUTER_PATH = join(MOBILE_ROOT, "components", "more", "MoreSectionRouter.tsx");

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function callCount(source: string, name: string): number {
  return source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0;
}

test("moves Story and Progress into one typed, inert-payload component", () => {
  assert.equal(
    existsSync(COMPONENT_PATH),
    true,
    "StoryProgressScreen.tsx must exist before the compatibility route delegates",
  );
  const component = read(COMPONENT_PATH);

  assert.match(component, /export interface StoryProgressScreenProps\s*\{/);
  assert.match(component, /entryId\?:\s*string/);
  assert.match(component, /walkId\?:\s*string/);
  assert.match(component, /onBack:\s*\(\)\s*=>\s*void/);
  assert.match(component, /onOpenAdventure:\s*\(\)\s*=>\s*void/);
  assert.match(
    component,
    /export default function StoryProgressScreen\(\{\s*onBack,\s*onOpenAdventure,?\s*\}:\s*StoryProgressScreenProps\)/,
  );
  assert.doesNotMatch(
    component,
    /StoryProgressScreen\(\{[^}]*\b(?:entryId|walkId)\b/,
    "validated IDs must not be destructured or acted on before a reviewed focus UX exists",
  );
  assert.doesNotMatch(component, /useLocalSearchParams/);
  assert.doesNotMatch(component, /useState[^\n]*(?:entryId|walkId)/);
  assert.doesNotMatch(component, /setSegment\([^)]*(?:entryId|walkId)/);
});

test("keeps Story and Progress read-only and preserves every real derivation", () => {
  const component = read(COMPONENT_PATH);

  assert.doesNotMatch(component, /\bAsyncStorage\b/);
  assert.doesNotMatch(component, /\buseMutation\b/);
  for (const forbidden of ["addEntry", "updateEntry", "deleteEntry", "updateCareDoc"]) {
    assert.equal(callCount(component, forbidden), 0, `${forbidden} must not write from Story`);
  }
  assert.doesNotMatch(component, /@workspace\/api-client|\bapiMutation\b|fetch\(|axios\./);

  for (const anchor of [
    "deriveAdventureMode",
    "deriveWalkActivity",
    "deriveWalkRouteTemplates",
    "deriveCareCareer",
    "deriveCareStreak",
    "deriveCareerWeek",
    "parseWalkRoute",
  ]) {
    assert.match(component, new RegExp(`\\b${anchor}\\b`), `${anchor} must survive the move`);
  }
  assert.match(component, /householdVisible === false/);
  assert.match(component, /return stories\.slice\(0, 3\)/);
  assert.match(component, /deriveWalkRouteTemplates\(\{ entries: state\.entries, now, limit: 3 \}\)/);
});

test("preserves Story assets, structure, safe areas, and accessibility anchors", () => {
  const component = read(COMPONENT_PATH);

  for (const asset of [
    "trail-thumb-1.png",
    "trail-thumb-2.png",
    "trail-thumb-3.png",
    "badge-1.png",
    "badge-2.png",
    "badge-3.png",
    "badge-trophy.png",
  ]) {
    assert.match(component, new RegExp(asset.replace(".", "\\.")), `${asset} must remain`);
  }
  assert.match(component, /type DayTrailStop/);
  assert.doesNotMatch(component, /<DayTrailScene\b/);
  assert.equal(component.match(/<BoardRouteHeader\b/g)?.length ?? 0, 1);
  assert.equal(component.match(/<ScrollView\b/g)?.length ?? 0, 1);
  assert.match(component, /title="Story & Progress"/);
  assert.match(component, /\{ key: "adventures", label: "Today" \}/);
  assert.match(component, /\{ key: "memories", label: "Memories" \}/);
  assert.match(component, /\{ key: "badges", label: "Progress" \}/);
  assert.match(component, /getRouteTopPadding/);
  assert.match(component, /surface:\s*"tabbed"/);
  assert.match(component, /getTabbedRouteBottomPadding/);
  assert.match(
    component,
    /<BoardRouteHeader[\s\S]{0,120}\n\s+back\n[\s\S]{0,120}onBack=\{onBack\}/,
    "the component must own its explicit Back control",
  );
  assert.match(component, /MIN_MOBILE_TOUCH_TARGET/);

  for (const anchor of [
    "Trail map of the latest recorded walk",
    "Private device-only view of the latest recorded walk route",
    "Open this log",
    "Open Adventure Trail",
    "Open walk story from",
    "Open adventure memory",
    "Open care log photo",
    "badge earned",
    "badge locked",
  ]) {
    assert.ok(component.includes(anchor), `${anchor} accessibility copy must remain`);
  }
});

test("uses canonical child transitions and consolidates weekly career metrics", () => {
  const component = read(COMPONENT_PATH);

  assert.match(component, /const openAdventure = onOpenAdventure/);
  assert.match(component, /onAction=\{openAdventure\}/);
  assert.ok(
    (component.match(/onPress=\{openAdventure\}/g)?.length ?? 0) >= 2,
    "Adventure rows and actions must use the parent seam",
  );
  assert.match(
    component,
    /router\.push\(\{\s*pathname:\s*"\/health",\s*params:\s*\{\s*section:\s*"records"\s*\}\s*\}\)/,
  );
  assert.match(component, /\/log\?type=walk&detail=1&intent=/);
  assert.match(component, /\/log\?entry=/);
  assert.doesNotMatch(component, /router\.(?:push|replace)\("\/adventure/);
  assert.doesNotMatch(component, /router\.(?:push|replace)\("\/records/);
  assert.doesNotMatch(component, /router\.(?:push|replace)\("\/story/);
  assert.doesNotMatch(component, /section=career/);

  assert.match(component, /const careerWeek = useMemo/);
  assert.match(component, /deriveCareerWeek\(state\.entries, now\)/);
  assert.match(component, /Logs this week/);
  assert.match(component, /Active days/);
  assert.match(component, /careerWeek\.logsThisWeek/);
  assert.match(component, /careerWeek\.activeDays/);
  assert.doesNotMatch(component, /title="Career & Stats"/);
  assert.doesNotMatch(component, /Open Career and Stats/);
});

test("keeps the hidden Story route as one small replace-only bridge", () => {
  const route = read(STORY_ROUTE_PATH);
  const router = read(ROUTER_PATH);

  assert.ok(route.length <= 1_400, `Story delegate should stay small, received ${route.length} chars`);
  assert.match(route, /useLocalSearchParams/);
  assert.match(route, /resolveCanonicalDestination/);
  assert.match(route, /pathname:\s*"\/story"/);
  assert.match(route, /<Redirect\s+href=\{redirectHref\}\s*\/>/);
  assert.doesNotMatch(route, /StoryProgressScreen|useRouter|router\./);
  assert.match(router, /<StoryProgressScreen[\s\S]{0,360}onBack=\{onBack\}[\s\S]{0,360}onOpenAdventure=\{\(\) => pushMore\("adventure"\)\}/);

  for (const forbidden of [
    "useCare",
    "deriveAdventureMode",
    "deriveCareCareer",
    "deriveWalkActivity",
    "StyleSheet",
    "ScrollView",
    "assets/story",
  ]) {
    assert.doesNotMatch(route, new RegExp(forbidden), `${forbidden} belongs only to the component`);
  }
});

test("keeps the More route model as the only Story payload validator", () => {
  const valid = resolveMoreSectionRoute({
    section: "story-progress",
    entry: "entry.alpha-1",
    walk: ["walk:2026_08", "ignored"],
  });
  assert.equal(valid.target.kind, "story-progress");
  assert.equal(valid.entryId, "entry.alpha-1");
  assert.equal(valid.walkId, "walk:2026_08");

  const invalid = resolveMoreSectionRoute({
    section: "story-progress",
    entry: "bad value",
    walk: [""],
  });
  assert.equal(invalid.entryId, undefined);
  assert.equal(invalid.walkId, undefined);

  const crossSection = resolveMoreSectionRoute({
    section: "care-team-supplies",
    entry: "entry-1",
    walk: "walk-1",
  });
  assert.equal(crossSection.entryId, undefined);
  assert.equal(crossSection.walkId, undefined);
});
