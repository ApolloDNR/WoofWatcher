import { test } from "node:test";
import assert from "node:assert/strict";

import {
  derivePremiumEntitlements,
  derivePremiumPreview,
  isPremiumFeatureUnlocked,
  PREMIUM_PLANS,
} from "../src/index.ts";

test("defines free, plus, and family premium packaging without checkout enabled", () => {
  assert.deepEqual(
    PREMIUM_PLANS.map((plan) => plan.id),
    ["free", "plus", "family"],
  );
  assert.equal(PREMIUM_PLANS.find((plan) => plan.id === "plus")?.monthlyPrice, "$7-$10/mo");
  assert.equal(PREMIUM_PLANS.find((plan) => plan.id === "family")?.monthlyPrice, "$12-$15/mo");
  assert.equal(PREMIUM_PLANS.some((plan) => plan.checkoutEnabled), false);
});

test("recommends family when the household workflow is the strongest paid signal", () => {
  const preview = derivePremiumPreview({
    caregiverCount: 3,
    routineCount: 5,
    reportHistoryCount: 1,
    recordCount: 4,
    healthSignalCount: 2,
  });

  assert.equal(preview.recommendedPlanId, "family");
  assert.equal(preview.checkoutEnabled, false);
  assert.equal(preview.valueSignals[0].key, "household");
  assert.ok(preview.valueSignals.some((signal) => signal.key === "reports"));
  assert.ok(preview.launchNotice.includes("payments"));
});

test("recommends plus when advanced care is valuable but household size is small", () => {
  const preview = derivePremiumPreview({
    caregiverCount: 1,
    routineCount: 3,
    reportHistoryCount: 0,
    recordCount: 1,
    healthSignalCount: 2,
  });

  assert.equal(preview.recommendedPlanId, "plus");
  assert.equal(preview.valueSignals[0].key, "health");
});

test("defines deterministic free, plus, and family entitlement gates", () => {
  const free = derivePremiumEntitlements("free");
  const plus = derivePremiumEntitlements("plus");
  const family = derivePremiumEntitlements("family");

  assert.ok(free.included.some((feature) => feature.key === "dog_profile"));
  assert.ok(free.locked.some((feature) => feature.key === "health_watch" && feature.requiredPlanId === "plus"));
  assert.ok(plus.included.some((feature) => feature.key === "health_watch"));
  assert.ok(plus.locked.some((feature) => feature.key === "household_roles" && feature.requiredPlanId === "family"));
  assert.equal(family.locked.length, 0);
});

test("answers whether a premium feature is unlocked for a plan", () => {
  assert.equal(isPremiumFeatureUnlocked("free", "basic_logs"), true);
  assert.equal(isPremiumFeatureUnlocked("free", "care_reports"), false);
  assert.equal(isPremiumFeatureUnlocked("plus", "care_reports"), true);
  assert.equal(isPremiumFeatureUnlocked("plus", "household_roles"), false);
  assert.equal(isPremiumFeatureUnlocked("family", "household_roles"), true);
});
