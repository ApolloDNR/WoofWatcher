import { test } from "node:test";
import assert from "node:assert/strict";

import { getHomeFirstScreenLayout } from "./homeFirstScreenLayout.ts";

test("selects the showcase Home room proportions for a large iPhone", () => {
  const layout = getHomeFirstScreenLayout({
    width: 430,
    height: 932,
    topPadding: 32,
    bottomChromeClearance: 102,
  });

  assert.equal(layout.density, "showcase");
  assert.equal(layout.routeHorizontalPadding, 16);
  assert.equal(layout.heroStageWidth, 398);
  assert.equal(layout.contentMinHeight, 932);
  assert.ok(layout.heroAspectRatio >= 1.42);
  assert.match(layout.qaLabel, /runtime-measured navigation clearance/);
  assert.equal("todayCommandPeekPx" in layout, false);
  assert.equal("firstMissionPeekPx" in layout, false);
});

test("uses a denser Home room on smaller phones without dropping touch targets", () => {
  const layout = getHomeFirstScreenLayout({
    width: 360,
    height: 780,
    topPadding: 32,
    bottomChromeClearance: 102,
  });

  assert.equal(layout.density, "compact");
  assert.ok(layout.heroAspectRatio >= 1.56);
  assert.ok(layout.presencePanelMinHeight >= 48);
});

test("never lets the Home first-screen controls shrink below accessible mobile targets", () => {
  for (const width of [320, 360, 390, 430]) {
    const layout = getHomeFirstScreenLayout({
      width,
      height: width < 390 ? 780 : 844,
      topPadding: 32,
      bottomChromeClearance: 102,
    });

    assert.ok(
      layout.heroStudioButtonMinHeight >= 48,
      `${width}px care twin button`,
    );
    assert.ok(layout.presencePanelMinHeight >= 48, `${width}px presence panel`);
  }
});

test("keeps the Home room inside the full phone surface at every supported width", () => {
  for (const width of [240, 320, 360, 390, 430]) {
    const layout = getHomeFirstScreenLayout({
      width,
      height: 844,
      topPadding: 32,
      bottomChromeClearance: 102,
    });

    assert.equal(
      layout.heroStageWidth + layout.routeHorizontalPadding * 2,
      width,
      `${width}px room plus route gutters should exactly fill the phone width`,
    );
    assert.equal(layout.contentMinHeight, 844);
  }
});
