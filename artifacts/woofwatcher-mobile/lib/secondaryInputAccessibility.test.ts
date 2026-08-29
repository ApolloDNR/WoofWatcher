import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const DIET_SOURCE = readFileSync(
  join(MOBILE_ROOT, "components", "health", "DietScreen.tsx"),
  "utf8",
);
const WOOFGUIDE_SOURCE = readFileSync(
  join(MOBILE_ROOT, "components", "more", "WoofGuideScreen.tsx"),
  "utf8",
);

test("Diet editor fields derive their accessible names from visible labels", () => {
  const fieldInput = Array.from(
    DIET_SOURCE.matchAll(/<TextInput\b[\s\S]*?\/>/g),
    (match) => match[0],
  ).find((input) => input.includes("value={field.value}"));

  assert.ok(fieldInput);
  assert.match(fieldInput, /accessibilityLabel=\{field\.label\}/);
});

test("WoofGuide names its composer and uses contrast-safe bright-copper bubble text", () => {
  const composer = Array.from(
    WOOFGUIDE_SOURCE.matchAll(/<TextInput\b[\s\S]*?\/>/g),
    (match) => match[0],
  ).find((input) => input.includes("value={input}"));

  assert.ok(composer);
  assert.match(composer, /accessibilityLabel=\{`Ask WoofGuide about \$\{name\}`\}/);
  assert.match(
    WOOFGUIDE_SOURCE,
    /item\.role === "user" \? colors\.brandNavy : colors\.foreground/,
  );
  assert.match(
    WOOFGUIDE_SOURCE,
    /s\.userBubble, \{ backgroundColor: colors\.copperBright \}/,
  );
  assert.doesNotMatch(
    WOOFGUIDE_SOURCE,
    /item\.role === "user" \? "#fff" : colors\.foreground/i,
  );
  const sendMarker = WOOFGUIDE_SOURCE.indexOf("onPress={() => sendMessage(input)}");
  const sendStart = WOOFGUIDE_SOURCE.lastIndexOf("<Pressable", sendMarker);
  const sendEnd = WOOFGUIDE_SOURCE.indexOf("</Pressable>", sendMarker);
  assert.ok(sendStart >= 0 && sendEnd > sendMarker);
  const sendAction = WOOFGUIDE_SOURCE.slice(sendStart, sendEnd);
  assert.match(
    sendAction,
    /accessibilityLabel=\{loading \? "WoofGuide is thinking" : "Send WoofGuide message"\}/,
  );
  assert.match(
    sendAction,
    /accessibilityState=\{\{ disabled: !input\.trim\(\) \|\| loading, busy: loading \}\}/,
  );
  assert.match(sendAction, /style=\{\(\{ pressed \}\) =>/);
  assert.match(sendAction, /pressed \? 0\.82 : 1/);
  assert.match(
    WOOFGUIDE_SOURCE,
    /accessibilityRole="progressbar"[\s\S]{0,220}accessibilityLiveRegion="polite"[\s\S]{0,220}accessibilityLabel="WoofGuide is thinking"/,
  );
});
