import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const AVATAR_SOURCE = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "more",
    "AvatarStudioScreen.tsx",
  ),
  "utf8",
);

test("Avatar primary actions use the theme's contrast-safe foreground", () => {
  for (const action of [
    { label: "Take photo", anchor: 'accessibilityLabel="Take dog photo"' },
    { label: "Save Avatar", anchor: 'accessibilityLabel="Save Avatar Studio draft"' },
  ] as const) {
    const actionStart = AVATAR_SOURCE.indexOf(action.anchor);
    assert.notEqual(actionStart, -1, action.label);
    const actionSource = AVATAR_SOURCE.slice(actionStart, actionStart + 1_200);
    assert.match(actionSource, /backgroundColor:\s*colors\.primary/, action.label);
    assert.match(actionSource, /color=\{colors\.primaryForeground\}/, action.label);
    assert.match(actionSource, /color:\s*colors\.primaryForeground/, action.label);
  }
});
