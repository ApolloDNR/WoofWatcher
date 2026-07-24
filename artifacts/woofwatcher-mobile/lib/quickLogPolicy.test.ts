import { test } from "node:test";
import assert from "node:assert/strict";

import {
  QUICK_LOG_ALONE_ACTION,
  QUICK_LOG_ACTIONS,
  quickLogActionByKey,
  resolveQuickLogIntent,
} from "./quickLogPolicy.ts";

test("keeps one canonical quick-log tile order for every surface", () => {
  assert.deepEqual(
    QUICK_LOG_ACTIONS.map((action) => action.key),
    ["meal", "potty", "walk", "medication", "water", "note"],
  );
  assert.deepEqual(
    QUICK_LOG_ACTIONS.map((action) => action.label),
    ["Meal", "Potty", "Walk", "Meds", "Water", "Note"],
  );
});

test("keeps meal and potty one-tap claims truthful and details reachable", () => {
  const meal = quickLogActionByKey("meal");
  const potty = quickLogActionByKey("potty");

  assert.equal(resolveQuickLogIntent(meal, { hasOpenWalk: false }).kind, "save");
  assert.equal(meal.quickClaim, "served-outcome-pending");
  assert.equal(meal.longPress, "details");

  assert.equal(resolveQuickLogIntent(potty, { hasOpenWalk: false }).kind, "save");
  assert.equal(potty.quickClaim, "potty-attempt");
  assert.equal(potty.longPress, "details");
});

test("keeps water one tap, medication and notes detail-first, and walk lifecycle-aware", () => {
  assert.equal(
    resolveQuickLogIntent(quickLogActionByKey("water"), {
      hasOpenWalk: false,
    }).kind,
    "save",
  );
  assert.equal(
    resolveQuickLogIntent(quickLogActionByKey("medication"), {
      hasOpenWalk: false,
    }).kind,
    "details",
  );
  assert.equal(
    resolveQuickLogIntent(quickLogActionByKey("note"), {
      hasOpenWalk: false,
    }).kind,
    "details",
  );
  assert.equal(
    resolveQuickLogIntent(quickLogActionByKey("walk"), {
      hasOpenWalk: false,
    }).kind,
    "start-walk",
  );
  assert.equal(
    resolveQuickLogIntent(quickLogActionByKey("walk"), {
      hasOpenWalk: true,
    }).kind,
    "open-walk",
  );
});

test("rejects unknown quick-log action keys instead of inventing a care type", () => {
  assert.throws(() => quickLogActionByKey("unknown"), /Unknown quick-log action/);
});

test("keeps Alone Time reachable as a secondary lifecycle without changing the six tiles", () => {
  assert.deepEqual(
    QUICK_LOG_ACTIONS.map((action) => action.key),
    ["meal", "potty", "walk", "medication", "water", "note"],
  );
  assert.equal(QUICK_LOG_ALONE_ACTION.key, "alone");
  assert.equal(
    resolveQuickLogIntent(QUICK_LOG_ALONE_ACTION, {
      hasOpenWalk: false,
      hasOpenAlone: false,
    }).kind,
    "start-alone",
  );
  assert.equal(
    resolveQuickLogIntent(QUICK_LOG_ALONE_ACTION, {
      hasOpenWalk: false,
      hasOpenAlone: true,
    }).kind,
    "open-alone",
  );
});
