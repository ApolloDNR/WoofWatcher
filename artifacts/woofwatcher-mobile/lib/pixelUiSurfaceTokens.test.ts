import { test } from "node:test";
import assert from "node:assert/strict";

import colors from "../constants/colors.ts";

test("keeps repeated board surfaces compact while preserving semantic pills", () => {
  assert.deepEqual(colors.pixelUi.radius, {
    card: 8,
    panel: 12,
    scene: 8,
    chip: 6,
    pill: 999,
  });
  assert.equal(colors.radius, 12);
});

test("keeps scrolling board cards on thin borders with a restrained close shadow", () => {
  assert.equal(colors.pixelUi.borderWidth, 1);
  assert.deepEqual(colors.pixelUi.shadow, {
    opacity: 0.04,
    radius: 6,
    y: 2,
    elevation: 1,
  });
});
