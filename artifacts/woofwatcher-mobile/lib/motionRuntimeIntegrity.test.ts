import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readMobile(...segments: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...segments), "utf8");
}

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `expected section start: ${start}`);
  assert.ok(endIndex > startIndex, `expected section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("tabs freeze inactive native screens and root navigation honors Reduce Motion", () => {
  const tabs = readMobile("app", "(tabs)", "_layout.tsx");
  const root = readMobile("app", "_layout.tsx");

  assert.match(tabs, /freezeOnBlur:\s*true/);
  assert.match(
    root,
    /animation:\s*reducedMotion\s*\?\s*"none"\s*:\s*"default"/,
  );
});

test("perpetual sprite and room motion stop while the route or app is inactive", () => {
  const sprite = readMobile("components", "SpriteSheetPlayer.tsx");
  const room = readMobile("components", "LivingPhoenixRoom.tsx");
  const avatarStudio = readMobile(
    "components",
    "more",
    "AvatarStudioScreen.tsx",
  );
  const dogProfile = readMobile("components", "more", "DogProfileScreen.tsx");

  assert.match(sprite, /useRouteMotionActive\(\)/);
  assert.match(sprite, /playing\s*&&\s*routeMotionActive/);
  assert.match(room, /useRouteMotionActive\(\)/);
  assert.match(room, /if \(reduced \|\| !routeMotionActive\) return/);
  assert.match(room, /motionActive=\{routeMotionActive\}/);
  assert.match(
    avatarStudio,
    /if \(reduced \|\| !routeMotionActive\) return;[\s\S]{0,100}Animated\.loop/,
  );
  assert.match(
    dogProfile,
    /if \(reduced \|\| !routeMotionActive\) return;[\s\S]{0,100}breath\.value = withRepeat/,
  );
});

test("reaction state is released by its fade completion, not an early JS timeout", () => {
  const room = readMobile("components", "LivingPhoenixRoom.tsx");

  assert.match(
    room,
    /withTiming\(0,[\s\S]{0,180}runOnJS\(clearActiveReaction\)/,
  );
  assert.doesNotMatch(
    room,
    /reactionTimer\.current\s*=\s*setTimeout\([\s\S]{0,120}choreography\.reactionDurationMs/,
  );
});

test("inactive Home preserves pending reactions and care-event windows", () => {
  const room = readMobile("components", "LivingPhoenixRoom.tsx");
  const careEventLifecycle = sourceSection(
    room,
    "const careEventTimer",
    "const careEventActive",
  );
  const suppliedReaction = sourceSection(
    room,
    "useEffect(() => {\n    if (!routeMotionActive || !reaction)",
    "// The banner owns its whole lifecycle",
  );
  const reactionLifecycle = sourceSection(
    room,
    "// The banner owns its whole lifecycle",
    "// Petting is affection-only feedback",
  );

  assert.match(
    careEventLifecycle,
    /if \(!routeMotionActive\) return;[\s\S]{0,180}careEventSignature !== careEventSignatureRef\.current/,
    "an inactive route must not consume a new care-event signature",
  );
  assert.match(
    careEventLifecycle,
    /return \(\) => \{[\s\S]{0,180}clearTimeout\(careEventTimer\.current\)[\s\S]{0,100}careEventTimer\.current = null/,
    "blurring must cancel the care-event timer without settling the event",
  );
  assert.match(
    careEventLifecycle,
    /\[careEventSettled, careEventSignature, routeMotionActive\]/,
    "focus changes must restart an unsettled care-event window",
  );
  assert.match(
    suppliedReaction,
    /if \(!routeMotionActive \|\| !reaction\) return/,
    "an inactive route must not consume a new reaction id",
  );
  assert.match(suppliedReaction, /\[reaction, routeMotionActive\]/);
  assert.match(
    reactionLifecycle,
    /if \(!routeMotionActive\) \{\s*reactionProgress\.value = 0;\s*return;\s*\}/,
  );
  assert.doesNotMatch(
    reactionLifecycle,
    /if \(!routeMotionActive\) \{[\s\S]{0,120}clearActiveReaction/,
    "blurring must retain the pending reaction for focus",
  );
});

test("raw layout entrances honor Reduce Motion in the trail and sleep bubble", () => {
  const trail = readMobile("components", "DayTrailScene.tsx");
  const room = readMobile("components", "LivingPhoenixRoom.tsx");

  assert.match(trail, /const reduced = useReducedMotion\(\)/);
  assert.match(trail, /entering=\{\s*reduced\s*\? undefined\s*:\s*FadeInDown/);
  assert.match(room, /entering=\{reduced \? undefined : FadeIn\}/);
  assert.match(room, /exiting=\{reduced \? undefined : FadeOut\}/);
});

test("Avatar Studio image transitions honor Reduce Motion", () => {
  const avatarStudio = readMobile(
    "components",
    "more",
    "AvatarStudioScreen.tsx",
  );
  const transitions = [...avatarStudio.matchAll(/transition=\{([^}]+)\}/g)].map(
    ([, expression]) => expression.trim(),
  );

  assert.ok(
    transitions.length >= 6,
    "expected Avatar Studio image transitions",
  );
  for (const transition of transitions) {
    assert.match(
      transition,
      /^(?:0|reduced\s*\?\s*0\s*:\s*\d+)$/,
      `unguarded Avatar Studio image transition: ${transition}`,
    );
  }
});

test("care navigation scrolling honors Reduce Motion", () => {
  for (const path of [
    ["app", "(tabs)", "calendar.tsx"],
    ["app", "(tabs)", "log.tsx"],
    ["app", "(tabs)", "health.tsx"],
  ]) {
    const source = readMobile(...path);
    assert.match(source, /const reducedMotion = useReducedMotion\(\)/);
    assert.doesNotMatch(
      source,
      /animated:\s*true/,
      `${path.join("/")} still forces smooth scrolling`,
    );
    assert.match(source, /animated:\s*!reducedMotion/);
  }
});

test("dense trend bars reveal with transforms instead of layout animation", () => {
  const trends = readMobile("components", "health", "TrendsScreen.tsx");

  assert.doesNotMatch(trends, /height:\s*[^,\n]*\* grow\.value/);
  assert.match(trends, /transform:\s*\[\{ translateY:/);
  assert.match(trends, /barCell:\s*\{[\s\S]*?overflow:\s*"hidden"[\s\S]*?\}/);
});

test("screen entrances have one owner and the remaining legacy entrance uses shared tokens", () => {
  for (const path of [
    ["app", "(tabs)", "calendar.tsx"],
    ["app", "(tabs)", "more.tsx"],
    ["components", "health", "RecordsScreen.tsx"],
    ["app", "premium.tsx"],
  ]) {
    const source = readMobile(...path);
    assert.doesNotMatch(
      source,
      /<Animated\.View style=\{\{ opacity: fade, transform: \[\{ translateY: slide \}\] \}\}>/,
      `${path.join("/")} still wraps its full screen in a second entrance`,
    );
  }

  const log = readMobile("app", "(tabs)", "log.tsx");
  assert.match(log, /duration:\s*MOTION_MS\.screen/);
  assert.match(log, /\.\.\.SPRING\.default/);
  assert.doesNotMatch(log, /duration:\s*460/);
});
