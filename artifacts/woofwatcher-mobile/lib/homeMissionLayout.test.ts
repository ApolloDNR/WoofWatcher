import { test } from "node:test";
import assert from "node:assert/strict";

import { getHomeMissionDeckLayout } from "./homeMissionLayout.ts";

test("uses a tighter mission deck on small iPhone-class screens", () => {
  const layout = getHomeMissionDeckLayout({ width: 360, missionCount: 4 });

  assert.equal(layout.density, "compact");
  assert.equal(layout.showBadge, false);
  assert.equal(layout.detailLines, 1);
  assert.equal(layout.rowMinHeight, 58);
  assert.ok(layout.estimatedDeckHeight <= 322);
  assert.match(layout.qaLabel, /compact/);
});

test("keeps the richer mission deck on larger phone and web previews", () => {
  const layout = getHomeMissionDeckLayout({ width: 430, missionCount: 4 });

  assert.equal(layout.density, "regular");
  assert.equal(layout.showBadge, true);
  assert.equal(layout.detailLines, 2);
  assert.equal(layout.rowMinHeight, 72);
  assert.ok(layout.estimatedDeckHeight <= 390);
  assert.match(layout.qaLabel, /regular/);
});

test("never lets the mission deck collapse below mobile touch targets", () => {
  for (const width of [320, 360, 390, 430]) {
    const layout = getHomeMissionDeckLayout({ width, missionCount: 4 });

    assert.ok(layout.rowMinHeight >= 48, `${width}px row should stay tappable`);
    assert.ok(layout.iconBoxSize >= 34, `${width}px icon should remain readable`);
    assert.ok(layout.ctaMinHeight >= 32, `${width}px CTA should remain reachable`);
  }
});
