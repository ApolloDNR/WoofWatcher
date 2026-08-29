import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const MORE_PATH = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
  "app",
  "(tabs)",
  "more.tsx",
);

test("provider review-status pills expose their visual selection to assistive technology", () => {
  const more = readFileSync(MORE_PATH, "utf8");
  const statusOptionsStart = more.indexOf(
    "providerDraft.providerStatus === statusOption.key",
  );
  const statusOptionsEnd = more.indexOf("</View>", statusOptionsStart);

  assert.ok(statusOptionsStart >= 0 && statusOptionsEnd > statusOptionsStart);
  assert.match(
    more.slice(statusOptionsStart, statusOptionsEnd),
    /accessibilityLabel=\{`Set provider setup status to \$\{statusOption\.label\}`\}[\s\S]{0,160}accessibilityState=\{\{ selected \}\}/,
  );
});
