import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE_ROOT = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
);
const RECORDS_ROUTE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "records.tsx");
const RECORDS_SCREEN_PATH = join(
  MOBILE_ROOT,
  "components",
  "health",
  "RecordsScreen.tsx",
);
const TRENDS_ROUTE_PATH = join(MOBILE_ROOT, "app", "trends.tsx");
const TRENDS_SCREEN_PATH = join(
  MOBILE_ROOT,
  "components",
  "health",
  "TrendsScreen.tsx",
);

test("keeps the extracted Records behavior behind a temporary compatibility bridge", () => {
  assert.ok(
    existsSync(RECORDS_SCREEN_PATH),
    "Health must own the substantive Records screen before the route becomes a bridge",
  );

  const route = readFileSync(RECORDS_ROUTE_PATH, "utf8");
  const screen = readFileSync(RECORDS_SCREEN_PATH, "utf8");

  assert.equal(
    route,
    'export { default } from "@/components/health/RecordsScreen";\n',
    "the compatibility route must re-export the same screen until HealthSectionRouter is installed",
  );
  assert.match(screen, /export default function RecordsScreen\(\)/);
  assert.match(screen, /from "@\/app\/\(tabs\)\/index";/);
  assert.doesNotMatch(screen, /from "\.\/index";/);
  assert.match(screen, /Records Command Vault/);
  assert.match(screen, /WOOFWATCHER DOG ID/);
  assert.match(screen, /title="Care Pass"/);
  assert.match(screen, /persistPickedMedia/);
  assert.match(screen, /updateCareDoc\(/);
});

test("keeps the extracted Trends behavior behind a temporary compatibility bridge", () => {
  assert.ok(
    existsSync(TRENDS_SCREEN_PATH),
    "Health must own the substantive Trends screen before the route becomes a bridge",
  );

  const route = readFileSync(TRENDS_ROUTE_PATH, "utf8");
  const screen = readFileSync(TRENDS_SCREEN_PATH, "utf8");

  assert.match(route, /import TrendsScreen from "@\/components\/health\/TrendsScreen"/);
  assert.match(route, /<Stack\.Screen options=\{\{ headerShown: false, title: "Trends" \}\}/);
  assert.match(route, /<TrendsScreen/);
  assert.match(route, /contentTopPadding=\{topPadding\}/);
  assert.match(route, /contentBottomPadding=\{bottomPadding\}/);
  assert.match(route, /onBack=\{\(\) =>/);
  assert.doesNotMatch(route, /deriveCareTrends|deriveMoodTrend|MoodLineChart|MetricBarChart/);
  assert.doesNotMatch(route, /Redirect|router\.replace\("\/health/);
  assert.match(screen, /export default function TrendsScreen\(\{/);
  assert.match(screen, /onBack:\s*\(\) => void/);
  assert.match(screen, /contentTopPadding\?: number/);
  assert.match(screen, /contentBottomPadding\?: number/);
  assert.doesNotMatch(screen, /Stack\.Screen|useRouter|useSafeAreaInsets/);
  assert.doesNotMatch(
    screen,
    /getRouteTopPadding|getStandaloneRouteBottomPadding/,
  );
  assert.match(screen, /deriveCareTrends/);
  assert.match(screen, /deriveMoodTrend/);
  assert.match(screen, /BoardSegmentTabs/);
  assert.match(screen, /MoodLineChart/);
  assert.match(screen, /MetricBarChart/);
});
