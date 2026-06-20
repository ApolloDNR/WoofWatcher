import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getFloatingTabChromeMetrics,
  getStandaloneRouteBottomPadding,
  getTabbedRouteBottomPadding,
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
