import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readTab(name: string): string {
  return readFileSync(join(MOBILE_ROOT, "app", "(tabs)", name), "utf8");
}

test("Home action clusters wrap instead of clipping narrow or large-text labels", () => {
  const home = readTab("index.tsx");

  assert.match(home, /welcomeActions:\s*\{[\s\S]*?flexWrap:\s*"wrap"/);
  assert.match(
    home,
    /welcomePrimary:\s*\{[\s\S]*?maxWidth:\s*"100%"[\s\S]*?flexShrink:\s*1/,
  );
  assert.match(home, /nextButtonRow:\s*\{[\s\S]*?flexWrap:\s*"wrap"/);
  assert.match(
    home,
    /nextButton:\s*\{[\s\S]*?maxWidth:\s*"100%"[\s\S]*?flexShrink:\s*1/,
  );
});

test("Health keeps overview root-like and lets key values reflow", () => {
  const health = readTab("health.tsx");

  assert.match(health, /back=\{section !== "overview"\}/);
  assert.match(
    health,
    /<Text\s+numberOfLines=\{2\}\s+style=\{\[\s*s\.summaryRowValue,/,
  );
  assert.match(
    health,
    /healthScoreToken:\s*\{[\s\S]*?minWidth:\s*78[\s\S]*?maxWidth:\s*"42%"/,
  );
  assert.doesNotMatch(health, /healthScoreToken:\s*\{[\s\S]*?\bwidth:\s*78/);
});
