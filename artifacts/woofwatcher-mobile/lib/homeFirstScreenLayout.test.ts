import { test } from "node:test";
import assert from "node:assert/strict";

import { getHomeFirstScreenLayout } from "./homeFirstScreenLayout.ts";

test("keeps the iPhone preview Home stage tight enough for the mission deck to peek above the paw nav", () => {
  const layout = getHomeFirstScreenLayout({
    width: 430,
    height: 932,
    topPadding: 32,
    bottomChromeClearance: 102,
  });

  assert.equal(layout.density, "showcase");
  assert.ok(layout.heroAspectRatio >= 1.42);
  assert.ok(layout.statusTileMinHeight <= 66);
  assert.ok(layout.todayCommandPeekPx >= 210);
  assert.ok(layout.firstMissionPeekPx >= 220);
  assert.match(layout.qaLabel, /mockup-accurate/);
});

test("uses a denser first-screen composition on smaller phones without dropping touch targets", () => {
  const layout = getHomeFirstScreenLayout({
    width: 360,
    height: 780,
    topPadding: 32,
    bottomChromeClearance: 102,
  });

  assert.equal(layout.density, "compact");
  assert.ok(layout.heroAspectRatio >= 1.56);
  assert.ok(layout.statusTileMinHeight >= 48);
  assert.ok(layout.statusTileMinHeight <= 60);
  assert.ok(layout.presencePanelMinHeight >= 48);
  assert.ok(layout.todayCommandPeekPx >= 120);
  assert.ok(layout.firstMissionPeekPx >= 150);
});

test("never lets the Home first-screen controls shrink below accessible mobile targets", () => {
  for (const width of [320, 360, 390, 430]) {
    const layout = getHomeFirstScreenLayout({
      width,
      height: width < 390 ? 780 : 844,
      topPadding: 32,
      bottomChromeClearance: 102,
    });

    assert.ok(layout.heroStudioButtonMinHeight >= 48, `${width}px care twin button`);
    assert.ok(layout.presencePanelMinHeight >= 48, `${width}px presence panel`);
    assert.ok(layout.statusTileMinHeight >= 48, `${width}px status tile`);
    assert.ok(layout.statusTileIconBoxSize >= 28, `${width}px status icon box`);
    assert.ok(layout.todayCommandPeekPx >= 80, `${width}px Today Command peek`);
  }
});
