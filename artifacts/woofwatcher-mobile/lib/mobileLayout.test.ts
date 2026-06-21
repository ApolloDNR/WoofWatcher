import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getCenteredModalBackdropPadding,
  getDockedComposerBottomPadding,
  getFloatingDebugButtonTopOffset,
  getFloatingFeedbackBottomOffset,
  getFloatingTabChromeMetrics,
  getKeyboardAvoidingVerticalOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
  getTabbedRouteBottomPadding,
  MOBILE_INLINE_HIT_SLOP,
  MIN_MOBILE_TOUCH_TARGET,
} from "./mobileLayout.ts";

test("derives iOS tabbed route padding from the floating paw and safe area", () => {
  const metrics = getFloatingTabChromeMetrics({ platform: "ios", bottomInset: 34 });

  assert.equal(metrics.tabBarHeight, 72);
  assert.equal(metrics.tabBarBottom, 8);
  assert.equal(metrics.centerFabBottom, 60);
  assert.equal(metrics.centerFabSize, 64);
  assert.equal(metrics.contentBottomPadding, 142);
  assert.equal(getTabbedRouteBottomPadding({ platform: "ios", bottomInset: 34 }), 142);
});

test("keeps Android and web tabbed routes clear of the floating nav without wasting space", () => {
  assert.equal(getTabbedRouteBottomPadding({ platform: "android", bottomInset: 0 }), 130);
  assert.equal(getTabbedRouteBottomPadding({ platform: "web", bottomInset: 99 }), 130);

  const webMetrics = getFloatingTabChromeMetrics({ platform: "web", bottomInset: 99 });
  assert.equal(webMetrics.tabBarHeight, 78);
  assert.equal(webMetrics.tabBarBottom, 12);
  assert.equal(webMetrics.centerFabBottom, 36);
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
