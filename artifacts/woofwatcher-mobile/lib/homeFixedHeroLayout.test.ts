import assert from "node:assert/strict";
import test from "node:test";

import {
  getHomeFixedHeroCollapseOffset,
  getHomeFixedHeroTop,
} from "./homeFixedHeroLayout.ts";

test("the fixed room starts at the same screen coordinate as its scrolling spacer", () => {
  assert.equal(
    getHomeFixedHeroTop({ topPadding: 32, spacerY: 284 }),
    316,
  );
});

test("the fixed room follows the welcome card through the entire collapse", () => {
  assert.equal(
    getHomeFixedHeroCollapseOffset({
      welcomeCardHeight: 180,
      welcomeCollapse: 1,
    }),
    0,
  );
  assert.equal(
    getHomeFixedHeroCollapseOffset({
      welcomeCardHeight: 180,
      welcomeCollapse: 0.5,
    }),
    -90,
  );
  assert.equal(
    getHomeFixedHeroCollapseOffset({
      welcomeCardHeight: 180,
      welcomeCollapse: 0,
    }),
    -180,
  );
});
