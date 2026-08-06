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
