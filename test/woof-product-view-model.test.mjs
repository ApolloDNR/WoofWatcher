import assert from "node:assert/strict";
import test from "node:test";
import { createEntry, getDefaultState } from "../src/woof-core.js";
import { buildProductViewModel } from "../src/woof-product-view-model.js";

test("builds a stable five-tab product contract for UI builders", () => {
  const state = {
    ...getDefaultState("2026-06-05T12:00:00.000Z"),
    entries: [
      createEntry({
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T14:00:00.000Z",
        portionEaten: "most"
      }),
      createEntry({
        type: "vomit",
        title: "Yellow bile",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T15:00:00.000Z"
      })
    ]
  };

  const model = buildProductViewModel(state, "2026-06-05T18:00:00.000Z");

  assert.deepEqual(model.navigation.map((item) => item.id), ["phoenix", "log", "plans", "health", "more"]);
  assert.equal(model.appName, "WoofWatcher");
  assert.equal(model.phoenix.profile.name, "Phoenix");
  assert.equal(model.phoenix.pulse.label, "Household Pulse");
  assert.equal(model.log.quickActions.some((action) => action.type === "alone"), true);
  assert.equal(model.more.dietProfile.bedtimeSnack.includes("Small snack"), true);
  assert.equal(model.more.carePass.packageType, "woofwatcher.care-room-transfer");
});

test("keeps product contract health-safe and UI-agnostic", () => {
  const state = {
    ...getDefaultState("2026-06-05T12:00:00.000Z"),
    entries: [
      createEntry({
        type: "vomit",
        title: "Yellow bile",
        occurredAt: "2026-06-05T16:00:00.000Z"
      })
    ]
  };

  const model = buildProductViewModel(state, "2026-06-05T18:00:00.000Z");
  const serialized = JSON.stringify(model);

  assert.match(model.health.boundary, /not a diagnosis/i);
  assert.match(model.more.woofGuide.boundary, /does not diagnose/i);
  assert.doesNotMatch(serialized, /diagnosed|treatment plan|cure/i);
  assert.equal(model.uiGuidance.visualStatus, "functional-placeholder");
});
