import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTodayTabAccessibilityHint,
  getCenteredModalBackdropPadding,
  getDockedComposerBottomPadding,
  getFormKeyboardScrollProps,
  getFloatingDebugButtonTopOffset,
  getFloatingFeedbackBottomOffset,
  getFloatingTabChromeMetrics,
  getFloatingTabKeyboardPresentation,
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  getTabbedRouteBottomPadding,
  MOBILE_INLINE_HIT_SLOP,
  MIN_MOBILE_TOUCH_TARGET,
} from "./mobileLayout.ts";

test("lets owners dismiss form keyboards with the platform-native drag gesture", () => {
  assert.deepEqual(getFormKeyboardScrollProps("ios"), {
    keyboardDismissMode: "interactive",
    keyboardShouldPersistTaps: "handled",
  });
  assert.deepEqual(getFormKeyboardScrollProps("android"), {
    keyboardDismissMode: "on-drag",
    keyboardShouldPersistTaps: "handled",
  });
  assert.deepEqual(getFormKeyboardScrollProps("web"), {
    keyboardDismissMode: "none",
    keyboardShouldPersistTaps: "handled",
  });
});

test("names the active dog in the shared Today tab hint", () => {
  assert.equal(
    buildTodayTabAccessibilityHint({ onToday: false, petName: "Milo" }),
    "Open Milo's room and today's care",
  );
  assert.equal(
    buildTodayTabAccessibilityHint({ onToday: false, petName: "My Dog" }),
    "Open Phoenix's room and today's care",
  );
  assert.equal(
    buildTodayTabAccessibilityHint({ onToday: false, petName: "  " }),
    "Open Phoenix's room and today's care",
  );
  assert.equal(
    buildTodayTabAccessibilityHint({ onToday: true, petName: "Milo" }),
    "Opens the fast log sheet",
  );
});

test("derives iOS tabbed route padding from the floating paw and safe area", () => {
  const metrics = getFloatingTabChromeMetrics({ platform: "ios", bottomInset: 34 });

  assert.equal(metrics.tabBarHeight, 84);
  assert.ok(
    metrics.tabBarHeight - 34 >= MIN_MOBILE_TOUCH_TARGET,
    "the visible iOS tab controls must retain a full touch target above the home indicator",
  );
  assert.equal(metrics.tabBarBottom, 12);
  assert.equal(metrics.centerFabBottom, 52);
  assert.equal(metrics.centerFabSize, 56);
  assert.equal(metrics.contentBottomPadding, 124);
  assert.equal(getTabbedRouteBottomPadding({ platform: "ios", bottomInset: 34 }), 124);
});

test("keeps Android and web tabbed routes clear of the floating nav without wasting space", () => {
  assert.equal(getTabbedRouteBottomPadding({ platform: "android", bottomInset: 0 }), 110);
  assert.equal(getTabbedRouteBottomPadding({ platform: "web", bottomInset: 99 }), 110);

  const webMetrics = getFloatingTabChromeMetrics({ platform: "web", bottomInset: 99 });
  assert.equal(webMetrics.tabBarHeight, 72);
  assert.equal(webMetrics.tabBarBottom, 12);
  assert.equal(webMetrics.centerFabBottom, 26);
});

test("keeps the floating paw chrome compact enough for first-screen command cards", () => {
  for (const platform of ["android", "web"]) {
    const metrics = getFloatingTabChromeMetrics({ platform, bottomInset: 0 });
    const bottomChromeClearance = Math.max(
      metrics.tabBarBottom + metrics.tabBarHeight,
      metrics.centerFabBottom + metrics.centerFabSize,
    );

    assert.ok(bottomChromeClearance <= 86, `${platform} bottom chrome should not eat the route`);
    assert.ok(metrics.centerFabSize >= MIN_MOBILE_TOUCH_TARGET, `${platform} center paw stays tappable`);
    assert.ok(metrics.tabBarHeight >= 72, `${platform} tab bar keeps labels readable`);
  }

  const iosMetrics = getFloatingTabChromeMetrics({ platform: "ios", bottomInset: 34 });
  const iosBottomChromeClearance = Math.max(
    iosMetrics.tabBarBottom + iosMetrics.tabBarHeight,
    iosMetrics.centerFabBottom + iosMetrics.centerFabSize,
  );

  assert.ok(iosBottomChromeClearance <= 110);
  assert.ok(iosMetrics.centerFabSize >= MIN_MOBILE_TOUCH_TARGET);
});

test("removes the custom Today control from visual and accessibility flow while the keyboard opens", () => {
  assert.deepEqual(getFloatingTabKeyboardPresentation({ progress: 0, travelDistance: 120 }), {
    opacity: 1,
    translateY: 0,
    pointerEvents: "box-none",
    accessibilityElementsHidden: false,
    importantForAccessibility: "auto",
  });
  assert.deepEqual(getFloatingTabKeyboardPresentation({ progress: 1, travelDistance: 120 }), {
    opacity: 0,
    translateY: 120,
    pointerEvents: "none",
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
  });
});

test("keeps standalone routes independent from the bottom tab chrome", () => {
  assert.equal(getStandaloneRouteBottomPadding({ platform: "ios", bottomInset: 34 }), 74);
  assert.equal(getStandaloneRouteBottomPadding({ platform: "android", bottomInset: 0 }), 72);
  assert.equal(getStandaloneRouteBottomPadding({ platform: "web", bottomInset: 34 }), 72);
});

test("keeps route headers clear of native notches and web chrome", () => {
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 0, surface: "tabbed" }), 8);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "tabbed" }), 52);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "tabbed" }), 32);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "standalone" }), 56);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "standalone" }), 30);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "setup" }), 58);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "setup" }), 38);
  assert.equal(getRouteTopPadding({ platform: "ios", topInset: 44, surface: "auth" }), 92);
  assert.equal(getRouteTopPadding({ platform: "web", topInset: 44, surface: "auth" }), 72);
});

test("keeps docked composer controls close enough to the thumb zone", () => {
  assert.equal(getDockedComposerBottomPadding({ platform: "ios", bottomInset: 34 }), 46);
  assert.equal(getDockedComposerBottomPadding({ platform: "android", bottomInset: 0 }), 12);
  assert.equal(getDockedComposerBottomPadding({ platform: "web", bottomInset: 99 }), 46);
});

test("keeps modal, feedback, debug, and keyboard offsets on shared contracts", () => {
  assert.equal(getModalSheetBottomPadding({ platform: "ios", bottomInset: 34 }), 54);
  assert.equal(getModalSheetBottomPadding({ platform: "android", bottomInset: 0 }), 32);
  assert.deepEqual(getCenteredModalBackdropPadding({ platform: "ios", topInset: 44, bottomInset: 34 }), {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 50,
  });
  assert.equal(getFloatingFeedbackBottomOffset({ platform: "ios", bottomInset: 34, surface: "tabbed" }), 130);
  assert.equal(getFloatingFeedbackBottomOffset({ platform: "web", bottomInset: 34, surface: "standalone" }), 56);
  assert.equal(getFloatingDebugButtonTopOffset({ platform: "ios", topInset: 44 }), 60);
  assert.equal(getKeyboardAvoidingVerticalOffset({ platform: "ios", topInset: 44, surface: "setup" }), 58);
  assert.equal(getKeyboardAvoidingVerticalOffset({ platform: "web", topInset: 44, surface: "setup" }), 0);
});

test("keeps mobile touch and inline hit targets release-safe", () => {
  assert.equal(MIN_MOBILE_TOUCH_TARGET, 48);
  assert.equal(MOBILE_INLINE_HIT_SLOP, 10);
});
