import assert from "node:assert/strict";
import test from "node:test";

import {
  getFloatingTabChromeMetrics,
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
