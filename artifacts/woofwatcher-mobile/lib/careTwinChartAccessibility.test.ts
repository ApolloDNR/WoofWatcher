import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = existsSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile"),
)
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();

function readMobileSource(...parts: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...parts), "utf8");
}

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `expected section start: ${start}`);
  assert.ok(endIndex > startIndex, `expected section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("care-twin reactions and pet hearts become static under Reduce Motion", () => {
  const room = readMobileSource("components", "LivingPhoenixRoom.tsx");
  const stagePose = sourceSection(
    room,
    "const stagePoseTimer",
    "const stagePoseAction",
  );
  const suppliedReaction = sourceSection(
    room,
    "if (!reaction) return;",
    "// Petting is affection-only feedback",
  );
  const petReaction = sourceSection(
    room,
    "const triggerPetReaction",
    "useEffect(() => {\n    if (ambientTimer.current)",
  );
  const petHeart = sourceSection(
    room,
    "function PetHeart",
    "function PetHeartsBurst",
  );

  assert.match(room, /const reduced = useReducedMotion\(\);/);
  assert.match(
    room,
    /if \(!reduced\) return;[\s\S]{0,180}cancelAnimation\(reactionProgress\);[\s\S]{0,120}cancelAnimation\(tap\);/,
  );
  assert.match(
    stagePose,
    /if \(reduced\) \{[\s\S]*cancelAnimation\(stagePoseOpacity\)[\s\S]*stagePoseOpacity\.value = 1/,
  );
  assert.match(
    suppliedReaction,
    /reactionProgress\.value = reduced\s*\? 1\s*:/,
  );
  assert.match(petReaction, /reactionProgress\.value = reduced\s*\? 1\s*:/);
  assert.match(petHeart, /const reduced = useReducedMotion\(\);/);
  assert.match(petHeart, /if \(reduced\) return;/);
  assert.match(petHeart, /opacity: reduced\s*\? 1\s*:/);
  assert.match(petHeart, /translateY: reduced\s*\? -12\s*:/);
});

test("Trends charts expose concise image summaries instead of silent shapes", () => {
  const trends = readMobileSource("components", "health", "TrendsScreen.tsx");

  assert.equal(
    Array.from(trends.matchAll(/accessibilityRole="image"/g)).length,
    2,
  );
  assert.match(trends, /const moodChartSummary = `Mood check-ins chart/);
  assert.match(trends, /Average \$\{moodAvg\.toFixed\(1\)\} out of 5/);
  assert.match(trends, /const activityChartSummary = `Active minutes chart/);
  assert.match(trends, /peak \$\{peakActivity\} minutes in one period/);
  assert.match(trends, /const pottyChartSummary = `Potty logs chart/);
  assert.match(trends, /peak \$\{peakPotty\}/);
  assert.match(trends, /accessibilityLabel=\{moodChartSummary\}/);
  assert.match(trends, /accessibilityLabel=\{activityChartSummary\}/);
  assert.match(trends, /accessibilityLabel=\{pottyChartSummary\}/);
});

test("Records gives the weight SVG an equivalent spoken summary", () => {
  const records = readMobileSource("components", "health", "RecordsScreen.tsx");
  const chart = sourceSection(
    records,
    "{/* Weight trend",
    "{/* Mood trend */}",
  );

  assert.match(
    records,
    /const weightChartAccessibilityLabel = `Weight trend chart/,
  );
  assert.match(
    records,
    /weigh-ins from \$\{formatChartWeight\(firstChartWeight\)\}/,
  );
  assert.match(records, /Goal \$\{formatChartWeight\(goalWeight\)\}/);
  assert.match(chart, /accessibilityRole="image"/);
  assert.match(chart, /accessibilityLabel=\{weightChartAccessibilityLabel\}/);
  assert.match(chart, /<Svg width=\{chartW\} height=\{chartH\}>/);
});
