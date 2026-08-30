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
  assert.match(hook, /navigation\.isFocused\(\)/);
  assert.match(hook, /AppState\.addEventListener\("change"/);
  assert.match(hook, /routeFocused && appState === "active"/);
  assert.match(hook, /setInterval\(refreshNow,\s*refreshIntervalMs\)/);
  assert.match(hook, /subscription\.remove\(\)/);
  assert.match(hook, /clearInterval\(timer\)/);
});

test("drives every mounted route's time-sensitive derivations from the live clock", () => {
  const plans = readMobile("app", "(tabs)", "calendar.tsx");
  const health = readMobile("app", "(tabs)", "health.tsx");
  const home = readMobile("app", "(tabs)", "index.tsx");
  const log = readMobile("app", "(tabs)", "log.tsx");
  const records = readMobile("components", "health", "RecordsScreen.tsx");
  const avatarStudio = readMobile(
    "components",
    "more",
    "AvatarStudioScreen.tsx",
  );
  const more = readMobile("app", "(tabs)", "more.tsx");
  const story = readMobile("components", "more", "StoryProgressScreen.tsx");

  for (const [screen, source] of [
    ["Plans", plans],
    ["Health", health],
    ["Home", home],
    ["Log", log],
    ["Records", records],
    ["Avatar Studio", avatarStudio],
    ["More", more],
    ["Story & Progress", story],
  ] as const) {
    assert.match(
      source,
      /import \{[\s\S]{0,100}\buseActiveCurrentTime\b[\s\S]{0,100}\} from "@\/hooks\/useActiveCurrentTime";/,
      `${screen} does not import the focus-aware clock`,
    );
    assert.match(
      source,
      /const now = useActiveCurrentTime\((?:60_000)?\);/,
      `${screen} does not use the focus-aware clock`,
    );
    assert.doesNotMatch(
      source,
      /setInterval\(\(\) => setNow\(Date\.now\(\)\)/,
      `${screen} still owns a raw wall-clock interval`,
    );
  }
});
