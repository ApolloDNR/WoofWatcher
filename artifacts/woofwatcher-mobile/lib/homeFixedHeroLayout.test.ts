import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getHomeFixedHeroCollapseOffset,
  getHomeFixedHeroTop,
  resolveHomeWelcomeCardHeight,
  resolveHomeWelcomeCardMaxHeight,
  shouldHoldHomeFixedHeroTop,
} from "./homeFixedHeroLayout.ts";

test("the fixed room starts at the same screen coordinate as its scrolling spacer", () => {
  assert.equal(
    getHomeFixedHeroTop({ topPadding: 32, spacerY: 284 }),
    316,
  );
});

test("the fixed room keeps one expanded baseline while its transform owns welcome collapse", () => {
  const expandedTop = getHomeFixedHeroTop({
    topPadding: 32,
    spacerY: 284,
    welcomeCardHeight: 180,
    welcomeCollapsed: false,
  });
  const rebuiltExpandedTop = getHomeFixedHeroTop({
    topPadding: 32,
    spacerY: 104,
    welcomeCardHeight: 180,
    welcomeCollapsed: true,
  });
  assert.equal(expandedTop, 316);
  assert.equal(rebuiltExpandedTop, expandedTop);

  const samples = [
    { welcomeCollapse: 1, spacerY: 284 },
    { welcomeCollapse: 0.5, spacerY: 194 },
    { welcomeCollapse: 0, spacerY: 104 },
  ];

  for (const sample of samples) {
    const paintedTop =
      expandedTop +
      getHomeFixedHeroCollapseOffset({
        welcomeCardHeight: 180,
        welcomeCollapse: sample.welcomeCollapse,
      });

    assert.equal(paintedTop, 32 + sample.spacerY);
  }
});

test("the fixed hero ignores spacer relayouts only while the welcome card is actively collapsing", () => {
  assert.equal(
    shouldHoldHomeFixedHeroTop({
      welcomeWasShown: true,
      welcomeShouldShow: false,
      welcomeCollapsed: false,
    }),
    true,
  );
  assert.equal(
    shouldHoldHomeFixedHeroTop({
      welcomeWasShown: false,
      welcomeShouldShow: false,
      welcomeCollapsed: false,
    }),
    false,
  );
  assert.equal(
    shouldHoldHomeFixedHeroTop({
      welcomeWasShown: true,
      welcomeShouldShow: true,
      welcomeCollapsed: false,
    }),
    false,
  );
  assert.equal(
    shouldHoldHomeFixedHeroTop({
      welcomeWasShown: true,
      welcomeShouldShow: false,
      welcomeCollapsed: true,
    }),
    false,
  );
});

test("Home restores the expanded welcome animation state when an undone log makes the card visible again", () => {
  const homeSource = readFileSync(
    new URL("../app/(tabs)/index.tsx", import.meta.url),
    "utf8",
  );
  const visibleBranch = /if \(welcomeShouldShow\) \{([\s\S]*?)\n    \}/.exec(
    homeSource,
  )?.[1];

  assert.ok(visibleBranch, "welcomeShouldShow branch must exist");
  assert.match(visibleBranch, /welcomeCollapse\.value = 1/);
  assert.match(visibleBranch, /setWelcomeCollapsed\(false\)/);
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
