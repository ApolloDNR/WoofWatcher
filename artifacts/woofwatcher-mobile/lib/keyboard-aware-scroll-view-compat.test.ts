import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

import * as mobileLayout from "./mobileLayout.ts";

function loadCompat(platform: "ios" | "web") {
  const file = new URL(
    "../components/KeyboardAwareScrollViewCompat.tsx",
    import.meta.url,
  );
  const source = readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: file.pathname,
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  const NativeKeyboardScroll = Symbol("NativeKeyboardScroll");
  const WebScroll = Symbol("WebScroll");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const requireModule = (request: string) => {
    if (request === "react") {
      return {
        forwardRef: (
          render: (props: Record<string, unknown>, ref: unknown) => unknown,
        ) => render,
      };
    }
    if (request === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (request === "react-native-keyboard-controller") {
      return { KeyboardAwareScrollView: NativeKeyboardScroll };
    }
    if (request === "react-native") {
      return { Platform: { OS: platform }, ScrollView: WebScroll };
    }
    if (request === "@/lib/mobileLayout") return mobileLayout;
    throw new Error(`Unexpected compatibility-wrapper dependency: ${request}`);
  };
  const run = new Function("require", "module", "exports", output);
  run(requireModule, module, module.exports);
  return {
    Compat: module.exports.KeyboardAwareScrollViewCompat as (
      props: Record<string, unknown>,
      ref: unknown,
    ) => { type: unknown; props: Record<string, unknown> },
    NativeKeyboardScroll,
    WebScroll,
  };
}

test("native keyboard-aware forms retain imperative scrolling and safe iOS defaults", () => {
  const { Compat, NativeKeyboardScroll } = loadCompat("ios");
  const ref = { current: null };
  const rendered = Compat({ children: "fields", testID: "dense-form" }, ref);

  assert.equal(rendered.type, NativeKeyboardScroll);
  assert.equal(rendered.props.ref, ref);
  assert.equal(rendered.props.bottomOffset, 35);
  assert.equal(rendered.props.keyboardDismissMode, "interactive");
  assert.equal(rendered.props.keyboardShouldPersistTaps, "handled");
  assert.equal(rendered.props.testID, "dense-form");
  assert.equal(rendered.props.children, "fields");
});

test("web forms keep the same ref and interaction contract on a regular ScrollView", () => {
  const { Compat, WebScroll } = loadCompat("web");
  const ref = { current: null };
  const rendered = Compat({ children: "fields" }, ref);

  assert.equal(rendered.type, WebScroll);
  assert.equal(rendered.props.ref, ref);
  assert.equal(rendered.props.keyboardDismissMode, "none");
  assert.equal(rendered.props.keyboardShouldPersistTaps, "handled");
});

test("keeps the Log edit-entry sheet keyboard-aware and bounded on compact phones", () => {
  const file = new URL("../app/(tabs)/log.tsx", import.meta.url);
  const source = readFileSync(file, "utf8");
  const editorStart = source.indexOf("{/* Entry editor modal */}");
  const editorEnd = source.indexOf(
    "{/* Post-log quick-note prompt */}",
    editorStart,
  );

  assert.ok(editorStart >= 0 && editorEnd > editorStart);
  const editor = source.slice(editorStart, editorEnd);

  assert.match(editor, /accessibilityViewIsModal/);
  assert.match(editor, /accessibilityLabel="Cancel editing care log"/);
  assert.match(
    editor,
    /<KeyboardAwareScrollViewCompat[\s\S]*?value=\{editTitle\}[\s\S]*?value=\{editNote\}[\s\S]*?label="Save changes"[\s\S]*?<\/KeyboardAwareScrollViewCompat>/,
    "the native modal must own the keyboard-aware scroll surface because the route-level scroller cannot move content inside a separate Modal",
  );
  assert.match(editor, /style=\{s\.editSheetFormScroll\}/);
  assert.match(
    source,
    /editSheet:\s*\{[^}]*maxHeight:\s*"90%"/,
    "the bottom sheet must stay bounded when text size or the keyboard reduces the viewport",
  );
  assert.match(source, /editSheetFormScroll:\s*\{[^}]*flexShrink:\s*1/);
});
