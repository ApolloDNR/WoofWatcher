import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gameFeel = readFileSync(
  new URL("../components/motion/GameFeel.tsx", import.meta.url),
  "utf8",
);
const boardPrimitives = readFileSync(
  new URL("../components/board/BoardPrimitives.tsx", import.meta.url),
  "utf8",
);
const story = readFileSync(
  new URL("../app/(tabs)/story.tsx", import.meta.url),
  "utf8",
);
const more = readFileSync(
  new URL("../app/(tabs)/more.tsx", import.meta.url),
  "utf8",
);

test("shared state changes use a short reduced-motion-safe pulse", () => {
  assert.match(gameFeel, /export function StateChangePulse/);
  assert.match(
    gameFeel,
    /StateChangePulse[\s\S]*useReducedMotion\(\)[\s\S]*withSequence\([\s\S]*withTiming/,
  );
  assert.match(
    gameFeel.match(/export function StateChangePulse[\s\S]*?\n}\n/)?.[0] ?? "",
    /reduceMotion:\s*ReduceMotion\.System/,
  );
  assert.doesNotMatch(
    gameFeel.match(/export function StateChangePulse[\s\S]*?\n}\n/)?.[0] ?? "",
    /entering=|FadeIn|FadeInDown/,
  );
  assert.match(gameFeel, /const bounce = useCallback\(\(\) =>/);
});

test("shared controls animate only real selected and value changes", () => {
  const segmentTabs = boardPrimitives.match(
    /export function BoardSegmentTabs[\s\S]*?\n}\n\n\/\*\* Storybook-mockup action button/,
  )?.[0] ?? "";
  assert.match(segmentTabs, /<StateChangePulse\s+value=\{isActive\}/);
  assert.match(segmentTabs, /<View accessibilityRole="tablist"/);
  assert.match(segmentTabs, /accessibilityRole="tab"/);
  assert.match(segmentTabs, /accessibilityState=\{\{ selected: isActive \}\}/);
  assert.match(
    segmentTabs,
    /backgroundColor:\s*isActive\s*\?\s*colors\.primary\s*:/,
  );
  assert.doesNotMatch(segmentTabs, /enterUp\(|segmentPill|pillStyle/);

  const statusPill = boardPrimitives.match(
    /export function BoardStatusPill[\s\S]*?\n}\n\n\/\*\* Storybook-mockup segmented/,
  )?.[0] ?? "";
  assert.match(statusPill, /<StateChangePulse[\s\S]*value=\{`\$\{tone\}:\$\{label\}`\}/);

  const metricTile = boardPrimitives.match(
    /export function BoardMetricTile[\s\S]*?\n}\n\nexport function BoardCard/,
  )?.[0] ?? "";
  assert.match(metricTile, /<StateChangePulse value=\{value\}>/);
});

test("progress fills expose truthful native progress semantics", () => {
  const progress = gameFeel.slice(gameFeel.indexOf("export function ProgressFill"));
  assert.match(progress, /accessibilityRole="progressbar"/);
  assert.match(progress, /accessibilityValue=\{\{[\s\S]*now:\s*Math\.round\(clamped \* 100\)/);
  assert.match(progress, /text:\s*accessibilityValueText/);
  assert.doesNotMatch(progress, /Math\.max\(0\.02/);
  assert.doesNotMatch(story, /ratio=\{Math\.max\(0\.02,/);
  assert.match(story, /accessibilityLabel=\{`\$\{career\.levelXp\} of \$\{career\.levelSpanXp\}/);
  assert.match(more, /<ProgressFill[\s\S]*?accessibilityValueText=/);
  assert.doesNotMatch(more, /<View\s+accessible\s+accessibilityRole="progressbar"[\s\S]*?<ProgressFill/);
});
