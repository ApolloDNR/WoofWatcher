import assert from "node:assert/strict";
import test from "node:test";

import {
  getFloatingTabChromeMetrics,
  getFloatingFeedbackBottomOffset,
  getCenteredModalBackdropPadding,
  getFloatingDebugButtonTopOffset,
  getModalSheetBottomPadding,
  getRouteTopPadding,
  getStandaloneComposerBottomPadding,
  getStandaloneRouteBottomPadding,
  getTabbedRouteBottomPadding,
} from "./mobileLayout.ts";

test("keeps floating tab chrome safe on native devices with home indicators", () => {
  const chrome = getFloatingTabChromeMetrics(34, false);

  assert.equal(chrome.tabBarBottom, 8);
  assert.equal(chrome.tabBarHeight, 72);
  assert.equal(chrome.fabBottom, 60);
  assert.equal(chrome.routeBottomPadding, 142);
});

test("keeps tabbed routes clear of the floating shell on flat native devices and web", () => {
  assert.equal(getTabbedRouteBottomPadding(0, false), 130);
  assert.equal(getTabbedRouteBottomPadding(0, true), 130);
});

test("keeps route headers clear of native notches and web chrome", () => {
  assert.equal(getRouteTopPadding(0, "tabbed", false), 8);
  assert.equal(getRouteTopPadding(44, "tabbed", false), 52);
  assert.equal(getRouteTopPadding(0, "tabbed", true), 32);
  assert.equal(getRouteTopPadding(0, "standalone", false), 12);
  assert.equal(getRouteTopPadding(44, "standalone", false), 56);
  assert.equal(getRouteTopPadding(0, "standalone", true), 30);
  assert.equal(getRouteTopPadding(0, "setup", false), 14);
  assert.equal(getRouteTopPadding(0, "setup", true), 38);
  assert.equal(getRouteTopPadding(44, "auth", false), 92);
  assert.equal(getRouteTopPadding(0, "auth", true), 72);
});

test("keeps standalone routes clear of the home indicator", () => {
  assert.equal(getStandaloneRouteBottomPadding(0), 88);
  assert.equal(getStandaloneRouteBottomPadding(34), 88);
  assert.equal(getStandaloneRouteBottomPadding(40), 94);
});

test("keeps standalone composer controls clear on flat and notched devices", () => {
  assert.equal(getStandaloneComposerBottomPadding(0, false), 24);
  assert.equal(getStandaloneComposerBottomPadding(34, false), 46);
  assert.equal(getStandaloneComposerBottomPadding(0, true), 46);
});

test("keeps docked modal sheets clear of flat and notched home indicators", () => {
  assert.equal(getModalSheetBottomPadding(0), 32);
  assert.equal(getModalSheetBottomPadding(18), 38);
  assert.equal(getModalSheetBottomPadding(34), 54);
});

test("keeps centered text modals away from notches and home indicators", () => {
  assert.deepEqual(getCenteredModalBackdropPadding(0, 0), {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 24,
  });
  assert.deepEqual(getCenteredModalBackdropPadding(44, 34), {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 50,
  });
});

test("keeps floating feedback above tab chrome and home indicators", () => {
  assert.equal(getFloatingFeedbackBottomOffset(0, "tabbed", false), 96);
  assert.equal(getFloatingFeedbackBottomOffset(34, "tabbed", false), 130);
  assert.equal(getFloatingFeedbackBottomOffset(0, "standalone", false), 22);
  assert.equal(getFloatingFeedbackBottomOffset(34, "standalone", false), 56);
  assert.equal(getFloatingFeedbackBottomOffset(0, "standalone", true), 56);
});

test("keeps floating debug controls below notches and web preview chrome", () => {
  assert.equal(getFloatingDebugButtonTopOffset(0, false), 16);
  assert.equal(getFloatingDebugButtonTopOffset(44, false), 60);
  assert.equal(getFloatingDebugButtonTopOffset(0, true), 40);
});
