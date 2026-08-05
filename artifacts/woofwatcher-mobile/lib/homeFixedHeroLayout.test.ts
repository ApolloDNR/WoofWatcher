import assert from "node:assert/strict";
import test from "node:test";

import {
  getHomeFixedHeroCollapseOffset,
  getHomeFixedHeroTop,
  resolveHomeWelcomeCardHeight,
  resolveHomeWelcomeCardMaxHeight,
} from "./homeFixedHeroLayout.ts";

test("the fixed room starts at the same screen coordinate as its scrolling spacer", () => {
  assert.equal(
    getHomeFixedHeroTop({ topPadding: 32, spacerY: 284 }),
    316,
  );
});

test("the painted fixed room stays aligned with its live spacer throughout welcome collapse", () => {
  const samples = [
    { welcomeCollapse: 1, spacerY: 284 },
    { welcomeCollapse: 0.5, spacerY: 194 },
    { welcomeCollapse: 0, spacerY: 104 },
  ];

  for (const sample of samples) {
    const fixedLayerTop = getHomeFixedHeroTop({
      topPadding: 32,
      spacerY: sample.spacerY,
      welcomeCardHeight: 180,
      welcomeCollapse: sample.welcomeCollapse,
    });
    const paintedTop =
      fixedLayerTop +
      getHomeFixedHeroCollapseOffset({
        welcomeCardHeight: 180,
        welcomeCollapse: sample.welcomeCollapse,
      });

    assert.equal(paintedTop, 32 + sample.spacerY);
  }
});

test("the expanded welcome card accepts the latest natural height after a resize", () => {
  assert.equal(
    resolveHomeWelcomeCardHeight({
      currentHeight: 220,
      measuredHeight: 180,
      welcomeShouldShow: true,
    }),
    180,
  );
  assert.equal(
    resolveHomeWelcomeCardHeight({
      currentHeight: 180,
      measuredHeight: 240,
      welcomeShouldShow: true,
    }),
    240,
  );
  assert.equal(
    resolveHomeWelcomeCardHeight({
      currentHeight: 240,
      measuredHeight: 120,
      welcomeShouldShow: false,
    }),
    240,
  );
});

test("the expanded welcome card remains unconstrained so it can grow after a resize", () => {
  assert.equal(
    resolveHomeWelcomeCardMaxHeight({
      naturalHeight: 180,
      welcomeCollapse: 1,
      welcomeShouldShow: true,
    }),
    undefined,
  );
  assert.equal(
    resolveHomeWelcomeCardMaxHeight({
      naturalHeight: 180,
      welcomeCollapse: 0.5,
      welcomeShouldShow: false,
    }),
    90,
  );
  assert.equal(
    resolveHomeWelcomeCardMaxHeight({
      naturalHeight: 180,
      welcomeCollapse: 0,
      welcomeShouldShow: false,
    }),
    0,
  );
});
