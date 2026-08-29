import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import palette from "../constants/colors.ts";
import {
  getNextWebDialogFocusIndex,
  WEB_DIALOG_STEP_TRANSITION_MS,
} from "./webDialogFocus.ts";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function read(...parts: string[]): string {
  return readFileSync(join(MOBILE_ROOT, ...parts), "utf8");
}

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

test("web dialog focus order wraps in both directions and recovers from outside focus", () => {
  assert.equal(getNextWebDialogFocusIndex(0, 2, false), 1);
  assert.equal(getNextWebDialogFocusIndex(1, 2, false), 0);
  assert.equal(getNextWebDialogFocusIndex(1, 2, true), 0);
  assert.equal(getNextWebDialogFocusIndex(0, 2, true), 1);
  assert.equal(getNextWebDialogFocusIndex(-1, 2, false), 0);
  assert.equal(getNextWebDialogFocusIndex(-1, 2, true), 1);
  assert.equal(getNextWebDialogFocusIndex(8, 2, false), 0);
  assert.equal(getNextWebDialogFocusIndex(8, 2, true), 1);
  assert.equal(getNextWebDialogFocusIndex(0, 1, false), 0);
  assert.equal(getNextWebDialogFocusIndex(0, 0, false), -1);
});

test("web dialog owns modal semantics, keyboard containment, and queue-safe focus restoration", () => {
  const source = read("components", "WebDialogHost.tsx");

  assert.match(source, /role="alertdialog"/);
  assert.match(source, /aria-modal=\{true\}/);
  assert.match(source, /aria-labelledby="web-dialog-title"/);
  assert.match(source, /aria-describedby="web-dialog-message"/);
  assert.match(source, /nativeID="web-dialog-title"/);
  assert.match(source, /nativeID="web-dialog-message"/);
  assert.match(source, /event\.key === "Tab"/);
  assert.match(
    source,
    /getNextWebDialogFocusIndex\([\s\S]{0,180}event\.shiftKey/,
  );
  assert.match(
    source,
    /const initialFocusRef = current\.cancelLabel != null\s*\? cancelButtonRef\s*: confirmButtonRef/,
  );
  assert.match(source, /initialFocusRef\.current\?\.focus\(\)/);
  assert.match(source, /previouslyFocusedRef\.current\?\.focus\(\)/);
  assert.match(source, /dialogSessionActiveRef\.current/);
  assert.match(source, /queueRef\.current/);
  assert.match(
    source,
    /if \(queueRef\.current\[0\] !== expectedRequest\) return/,
  );
  assert.match(source, /addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(
    source,
    /const confirmForeground = current\.destructive\s*\? colors\.brandNavy\s*: colors\.primaryForeground/,
  );
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /createDeliberateConfirmationLatch/);
  assert.match(source, /trySettleDeliberateConfirmation/);
  assert.match(source, /transitionDeliberateConfirmation/);
  assert.match(
    source,
    /accessibilityState=\{\{ disabled: activationBlocked \}\}/,
  );
  assert.match(source, /disabled=\{activationBlocked\}/);
  assert.ok(WEB_DIALOG_STEP_TRANSITION_MS >= 300);
});

test("Privacy deletion binds both displayed stages to a transition latch", () => {
  const source = read("components", "more", "PrivacyDataScreen.tsx");

  assert.match(source, /createDeliberateConfirmationLatch/);
  assert.match(source, /activateDeliberateConfirmation/);
  assert.match(source, /trySettleDeliberateConfirmation/);
  assert.match(source, /transitionDeliberateConfirmation/);
  assert.match(source, /resetDeliberateConfirmation/);
  assert.match(
    source,
    /accessibilityState=\{\{[\s\S]{0,100}disabled:[\s\S]{0,100}localDataOperationBusy \|\| eraseTransitionBlocked/,
  );
  assert.match(
    source,
    /disabled=\{localDataOperationBusy \|\| eraseTransitionBlocked\}/,
  );
});

test("shared auth errors announce immediately with AA text in light and dark palettes", () => {
  const source = read("components", "auth-ui.tsx");
  const formError = sourceBetween(
    source,
    "export function FormError",
    "const styles = StyleSheet.create",
  );

  assert.match(formError, /role="alert"/);
  assert.match(formError, /accessibilityRole="alert"/);
  assert.match(formError, /aria-live="assertive"/);
  assert.match(formError, /backgroundColor: colors\.destructive/);
  assert.match(
    formError,
    /color: colors\.isDark\s*\? colors\.brandNavy\s*: colors\.destructiveForeground/,
  );
  assert.ok(
    contrast(palette.light.destructiveForeground, palette.light.destructive) >=
      4.5,
  );
  assert.ok(contrast(palette.dark.brandNavy, palette.dark.destructive) >= 4.5);
});

test("setup selected controls use the palette foreground token", () => {
  const source = read("app", "setup.tsx");

  assert.match(
    source,
    /selected\s*\?\s*colors\.primaryForeground\s*:\s*colors\.primary/,
  );
  assert.match(
    source,
    /selected\s*\?\s*colors\.primaryForeground\s*:\s*colors\.foreground/,
  );
  assert.doesNotMatch(source, /selected\s*\?\s*"#(?:fff|FFFFFF)"/i);
});

test("modal owners use the shared named close action without a second visible X", () => {
  const error = read("components", "ErrorFallback.tsx");
  const privacy = read("components", "more", "PrivacyDataScreen.tsx");
  const guide = read("components", "more", "WoofGuideScreen.tsx");
  const errorModal = sourceBetween(error, "<Modal\n", "</Modal>");
  const privacyEditor = sourceBetween(
    privacy,
    "visible={launchEditorOpen}",
    "</Modal>",
  );
  const ownerReview = sourceBetween(
    guide,
    "visible={reviewAction !== null}",
    "</Modal>",
  );

  assert.match(errorModal, /closeAccessibilityLabel="Close error details"/);
  assert.match(
    privacyEditor,
    /closeAccessibilityLabel="Close launch support profile editor"/,
  );
  assert.match(ownerReview, /closeAccessibilityLabel="Close owner review"/);
  for (const modal of [errorModal, privacyEditor, ownerReview]) {
    assert.doesNotMatch(
      modal,
      /<Pressable[\s\S]{0,260}<Ionicons?[^>]+name="close"/,
    );
    assert.doesNotMatch(modal, /<Pressable[\s\S]{0,260}<Feather[^>]+name="x"/);
  }
});

test("shared modal close exposes busy state and Records cannot focus a no-op close", () => {
  const primitives = read("components", "board", "BoardPrimitives.tsx");
  const records = read("components", "health", "RecordsScreen.tsx");
  const sharedSheet = sourceBetween(
    primitives,
    "export function ModalSheetPressable",
    "function firstParam",
  );

  assert.match(sharedSheet, /closeDisabled = false/);
  assert.match(sharedSheet, /closeBusy = false/);
  assert.match(
    sharedSheet,
    /const closeBlocked = closeDisabled \|\| closeBusy/,
  );
  assert.match(sharedSheet, /if \(!visible \|\| closeBlocked\) return/);
  assert.match(sharedSheet, /onAccessibilityEscape=\{requestCloseIfAllowed\}/);
  assert.match(sharedSheet, /disabled=\{closeBlocked\}/);
  assert.match(
    sharedSheet,
    /accessibilityState=\{\{ disabled: closeBlocked, busy: closeBusy \}\}/,
  );

  const carePassSheet = sourceBetween(
    records,
    "visible={carePassPreview !== null}",
    "style={[",
  );
  assert.match(carePassSheet, /closeDisabled=\{carePassSaveShareBusy\}/);
  assert.match(carePassSheet, /closeBusy=\{carePassSaveShareBusy\}/);

  const recordEditorSheet = sourceBetween(
    records,
    "visible={recordOpen}",
    "style={[",
  );
  assert.match(recordEditorSheet, /closeDisabled=\{recordSaveBusy\}/);
  assert.match(recordEditorSheet, /closeBusy=\{recordSaveBusy\}/);
});

test("error recovery and Diet save expose explicit button semantics", () => {
  const error = read("components", "ErrorFallback.tsx");
  const diet = read("components", "health", "DietScreen.tsx");
  const restart = sourceBetween(
    error,
    "onPress={handleRestart}",
    "</Pressable>",
  );
  const saveDiet = sourceBetween(diet, "onPress={saveDiet}", "</Pressable>");

  assert.match(restart, /accessibilityRole="button"/);
  assert.match(restart, /accessibilityLabel="Try again"/);
  assert.match(saveDiet, /accessibilityRole="button"/);
  assert.match(saveDiet, /accessibilityLabel="Save diet profile"/);
});

test("Privacy destructive confirmation keeps its measured rose and navy pair", () => {
  const source = read("components", "more", "PrivacyDataScreen.tsx");

  assert.match(source, /backgroundColor: colors\.rose/);
  assert.match(source, /color: colors\.brandNavy/);
  assert.ok(contrast(palette.light.brandNavy, palette.light.rose) >= 4.5);
  assert.ok(contrast(palette.dark.brandNavy, palette.dark.rose) >= 4.5);
});
