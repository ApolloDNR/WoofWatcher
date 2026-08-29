import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const health = readFileSync(
  new URL("../app/(tabs)/health.tsx", import.meta.url),
  "utf8",
);

test("Health and Bile snapshots do not offer a dead or misleading seven-day navigation action", () => {
  const snapshotPanel = health.match(
    /<View\s+style=\{\[\s*s\.healthHeroPanel,[\s\S]*?<View\s+style=\{s\.healthHeroStatusRow\}>/,
  )?.[0];
  assert.ok(snapshotPanel, "the snapshot panel must remain inspectable");
  assert.doesNotMatch(snapshotPanel, /HealthHeaderAction/);
  assert.doesNotMatch(snapshotPanel, /selectHealthTab\("health"\)/);
  assert.doesNotMatch(health, /accessibilityLabel="Show Health 7-day rhythm"/);
});

test("the Bile route hierarchy gives its chart and summary distinct factual labels", () => {
  assert.match(
    health,
    /<BoardSectionHeader\s+title="7-day bile log"\s+style=\{s\.boardSectionTop\}\s*\/>/,
  );
  assert.match(health, />\s*Recent timing\s*<\/Text>/);
  assert.match(health, /const snapshotTitle = isBileTab \? "Bile Snapshot"/);
});
