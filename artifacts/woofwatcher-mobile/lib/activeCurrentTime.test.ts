import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function readMobile(...segments: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...segments), "utf8");
}

test("keeps the live clock scoped to route focus and active AppState", () => {
  const hook = readMobile("hooks", "useActiveCurrentTime.ts");

  assert.match(hook, /useFocusEffect\(/);
  assert.match(hook, /AppState\.addEventListener\("change"/);
  assert.match(hook, /appState\s*!==\s*"active"/);
  assert.match(hook, /setInterval\(refreshNow,\s*refreshIntervalMs\)/);
  assert.match(hook, /subscription\.remove\(\)/);
  assert.match(hook, /clearInterval\(timer\)/);
});

test("drives Plans and Health time-sensitive derivations from the live clock", () => {
  const plans = readMobile("app", "(tabs)", "calendar.tsx");
  const health = readMobile("app", "(tabs)", "health.tsx");

  for (const [screen, source] of [
    ["Plans", plans],
    ["Health", health],
  ] as const) {
    assert.match(
      source,
      /import \{ useActiveCurrentTime \} from "@\/hooks\/useActiveCurrentTime";/,
      `${screen} does not import the focus-aware clock`,
    );
    assert.match(
      source,
      /const now = useActiveCurrentTime\(\);/,
      `${screen} does not use the focus-aware clock`,
    );
  }
});
