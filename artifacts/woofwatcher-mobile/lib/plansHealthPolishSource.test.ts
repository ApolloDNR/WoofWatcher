import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const mobileRoot = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readRoute(name: "calendar" | "health"): string {
  return readFileSync(join(mobileRoot, "app", "(tabs)", `${name}.tsx`), "utf8");
}

test("keeps the Plans sample state routine-first, compact, and non-interactive", () => {
  const plans = readRoute("calendar");
  const routeHeader = plans.slice(
    plans.indexOf("<BoardRouteHeader"),
    plans.indexOf("<BoardCard style={s.commandDeckCard}>")
  );

  assert.match(
    routeHeader,
    /onAction=\{\(\) => \{[\s\S]*?if \(isSampleSchedule\)[\s\S]*?openNewRoutine\(\)[\s\S]*?openAddEvent\(\)/,
    "the empty Plans header action should add the first routine instead of opening an event editor",
  );
  assert.match(plans, /const SAMPLE_SCHEDULE_PREVIEW_LIMIT = 4;/);
  assert.match(
    plans,
    /const visibleScheduleRows = isSampleSchedule\s*\? scheduleRows\.slice\(0, SAMPLE_SCHEDULE_PREVIEW_LIMIT\)\s*:\s*scheduleRows;/,
  );

  const firstRoutineCta = plans.indexOf('label="Add your first routine"');
  const sampleList = plans.indexOf("<View style={s.scheduleList}>");
  assert.ok(firstRoutineCta >= 0, "the sample state should expose an Add first routine action");
  assert.ok(
    firstRoutineCta < sampleList,
    "the Add first routine action should appear before the preview schedule",
  );
  assert.doesNotMatch(
    plans,
    /scheduleSampleRow:\s*\{[^}]*opacity:/,
    "sample copy should remain readable instead of looking disabled",
  );

  const scheduleMap = plans.indexOf("visibleScheduleRows.map");
  const sampleBranch = plans.slice(
    plans.indexOf("if (isSampleSchedule)", scheduleMap),
    plans.indexOf("const sourceRoutine", scheduleMap),
  );
  assert.match(sampleBranch, /<View[\s\S]*?accessible/);
  assert.match(sampleBranch, /accessibilityLabel=\{`Sample day preview:/);
  assert.doesNotMatch(
    sampleBranch,
    /<PressScale|<Pressable/,
    "preview rows must stay truthful and non-interactive",
  );
  const weeklyGoalStyle = plans.indexOf("style={[s.weeklyGoalPanel");
  const weeklyGoalPanelOpen = plans.slice(
    plans.lastIndexOf("<View", weeklyGoalStyle),
    plans.indexOf(">", weeklyGoalStyle) + 1,
  );
  assert.doesNotMatch(
    weeklyGoalPanelOpen,
    /\baccessible\b|accessibilityLabel=/,
    "the weekly panel must not group and hide its nested progressbar semantics",
  );
  assert.match(
    plans,
    /<ProgressFill[\s\S]*?accessibilityLabel=\{`Weekly care rhythm, \$\{weeklyGoalDays\} of 7 days`\}/,
    "the weekly care progressbar should expose a useful accessible name",
  );
});

test("uses sparse Health evidence copy and a non-interactive seven-day label", () => {
  const health = readRoute("health");

  assert.match(
    health,
    /const hasSparseHealthEvidence =\s*healthWatch\.status === "good" &&\s*loggedDays7 >= 1 &&\s*loggedDays7 <= 2;/,
  );
  assert.match(
    health,
    /hasSparseHealthEvidence\s*\? "Building the picture"/,
    "one or two logged days should not be presented as a stable trend",
  );
  assert.match(health, /`\$\{loggedDays7\} of 7 days logged\./);
  assert.doesNotMatch(health, /You're on a roll\./);

  const snapshotHeader = health.slice(
    health.indexOf("title={snapshotTitle}"),
    health.indexOf("<View style={s.healthHeroStatusRow}>")
  );
  assert.match(snapshotHeader, /<BoardPill label="Last 7 days" tone=\{colors\.forest\} \/>/);
  assert.doesNotMatch(snapshotHeader, /HealthHeaderAction|onPress=/);
  assert.doesNotMatch(health, /Show Health 7-day rhythm/);
  assert.doesNotMatch(health, /scrollTo\(\{ y: 0, animated: true \}\)/);
});

test("uses high-contrast ink for tiny Plans and Health labels without route fades", () => {
  const plans = readRoute("calendar");
  const health = readRoute("health");

  assert.match(plans, /s\.commandDeckKicker, \{ color: colors\.forest/);
  assert.match(plans, /s\.scheduleEyebrow, \{ color: colors\.forest/);
  assert.match(plans, /s\.scheduleBandText, \{ color: colors\.forest/);
  assert.match(health, /s\.healthScoreLabel, \{ color: colors\.forest/);
  assert.match(health, /s\.heroLabel, \{ color: colors\.forest/);
  assert.match(health, /s\.healthRhythmTitle, \{ color: colors\.forest/);

  for (const source of [plans, health]) {
    assert.doesNotMatch(source, /new Animated\.Value\([^)]*\)/);
    assert.doesNotMatch(source, /<Animated\.View[\s\S]*?opacity:/);
  }
});
