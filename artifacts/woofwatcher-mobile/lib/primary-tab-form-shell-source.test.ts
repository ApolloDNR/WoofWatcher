import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readMobileFile(...segments: string[]) {
  return readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", ...segments),
    "utf8",
  );
}

function routeHeader(source: string, title: string) {
  const titleMarker = `title="${title}"`;
  const titleIndex = source.indexOf(titleMarker);
  assert.notEqual(titleIndex, -1, `missing route header title: ${title}`);
  const start = source.lastIndexOf("<BoardRouteHeader", titleIndex);
  const end = source.indexOf("/>", titleIndex);
  assert.ok(
    start >= 0 && end > titleIndex,
    `could not isolate ${title} route header`,
  );
  return source.slice(start, end + 2);
}

function modalSlice(source: string, visibleMarker: string) {
  const marker = source.indexOf(visibleMarker);
  assert.notEqual(marker, -1, `missing modal marker: ${visibleMarker}`);
  const start = source.lastIndexOf("<Modal", marker);
  const end = source.indexOf("</Modal>", marker);
  assert.ok(start >= 0 && end > marker, `could not isolate ${visibleMarker}`);
  return source.slice(start, end + "</Modal>".length);
}

function assertKeyboardAwareFlow(
  source: string,
  inputMarker: RegExp,
  actionMarker: RegExp,
  name: string,
) {
  const wrapperStart = source.indexOf("<KeyboardAwareScrollViewCompat");
  const wrapperEnd = source.indexOf(
    "</KeyboardAwareScrollViewCompat>",
    wrapperStart,
  );
  assert.ok(
    wrapperStart >= 0 && wrapperEnd > wrapperStart,
    `${name} needs a keyboard-aware scroll owner`,
  );
  const wrapper = source.slice(wrapperStart, wrapperEnd);
  assert.match(
    wrapper,
    inputMarker,
    `${name} input must belong to the keyboard-aware scroll owner`,
  );
  assert.match(
    wrapper,
    actionMarker,
    `${name} action must remain reachable inside the keyboard-aware scroll owner`,
  );
}

test("primary tab roots do not present a false pushed-screen Back action", () => {
  for (const [file, title] of [
    ["log.tsx", "Log"],
    ["health.tsx", "Health Watch"],
    ["more.tsx", "More"],
  ] as const) {
    const source = readMobileFile("app", "(tabs)", file);
    assert.doesNotMatch(
      routeHeader(source, title),
      /\bback\b|onBack\s*=/,
      `${title} is a primary tab and must not imply a dismissible navigation layer`,
    );
  }

  const records = readMobileFile("app", "(tabs)", "records.tsx");
  assert.match(routeHeader(records, "Records"), /\bback\b/);
  assert.match(routeHeader(records, "Records"), /onBack\s*=/);
});

test("the Log root keeps its composer fields and submit action keyboard-aware", () => {
  const log = readMobileFile("app", "(tabs)", "log.tsx");
  assert.match(
    log,
    /import \{ KeyboardAwareScrollViewCompat \} from "@\/components\/KeyboardAwareScrollViewCompat"/,
  );

  const rootStart = log.indexOf("<KeyboardAwareScrollViewCompat");
  const rootEnd = log.indexOf("</KeyboardAwareScrollViewCompat>", rootStart);
  assert.ok(
    rootStart >= 0 && rootEnd > rootStart,
    "Log root needs one keyboard-aware vertical owner",
  );
  const root = log.slice(rootStart, rootEnd);
  assert.match(
    root,
    /ref=\{scrollRef\}/,
    "Log must preserve its measured composer scrolling",
  );
  assert.match(root, /<TextInput[\s\S]*?accessibilityLabel=/);
  assert.match(root, /onPress=\{handleLog\}/);
  assert.match(
    root,
    /<ScrollView\s+horizontal/,
    "horizontal type and filter rails must remain nested lists",
  );
});

test("More keeps every dense editing sheet keyboard-aware without replacing its anchored root list", () => {
  const more = readMobileFile("app", "(tabs)", "more.tsx");
  assert.match(
    more,
    /import \{ KeyboardAwareScrollViewCompat \} from "@\/components\/KeyboardAwareScrollViewCompat"/,
  );
  assert.match(
    more,
    /<ScrollView[\s\S]*?ref=\{scrollRef\}[\s\S]*?<BoardRouteHeader[\s\S]*?title="More"/,
    "the non-editing More root must preserve its anchored ScrollView",
  );

  assertKeyboardAwareFlow(
    modalSlice(more, "visible={dietEditOpen}"),
    /<TextInput[\s\S]*?value=\{f\.value\}/,
    /Save diet profile/,
    "Diet Profile",
  );
  assertKeyboardAwareFlow(
    modalSlice(more, "visible={providerSetupOpen}"),
    /<TextInput[\s\S]*?value=\{providerDraft\.notes\}/,
    /Save provider setup/,
    "Provider Launch Setup",
  );
  assertKeyboardAwareFlow(
    modalSlice(more, "visible={profileOpen}"),
    /<TextInput[\s\S]*?value=\{pName\}/,
    /Save profile/,
    "Dog Profile",
  );

  const promptStart = more.indexOf("function PromptModal");
  const promptEnd = more.indexOf("const s = StyleSheet.create", promptStart);
  assert.ok(
    promptStart >= 0 && promptEnd > promptStart,
    "could not isolate PromptModal",
  );
  assertKeyboardAwareFlow(
    more.slice(promptStart, promptEnd),
    /<TextInput[\s\S]*?value=\{value\}/,
    /accessibilityLabel=\{\s*loading\s*\? `\$\{confirmLabel\} in progress`\s*: confirmLabel\s*\}/,
    "household prompt",
  );
});
