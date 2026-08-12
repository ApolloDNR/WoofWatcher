import assert from "node:assert/strict";
import test from "node:test";

import { convertLegacyState, parseLegacyState } from "./legacyImport.ts";

/**
 * The legacy web PWA seeded EVERY install with this factory demo state
 * (mirrors artifacts/woofwatcher/src/vanilla/woof-core.js getDefaultState).
 * The import's honesty contract: factory fiction never crosses over, real
 * owner data always does.
 */
function factoryState(now = "2026-07-01T12:00:00.000Z") {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    profile: {
      name: "Phoenix",
      publicLabel: "Phoenix",
      breed: "German Shepherd / Belgian Shepherd mix",
      background: "Rescued over a year ago after being underweight and food anxious.",
      careFocus: "Keep routines calm, document appetite patterns, and prevent long empty-stomach windows.",
      weight: { current: 56.2, goal: "Slow, vet-guided weight gain and stable appetite", unit: "lb" },
    },
    caregivers: [
      { name: "Apollo", role: "Primary caregiver" },
      { name: "Girlfriend", role: "Primary caregiver" },
    ],
    dietProfile: {
      primaryFood: "Regular kibble Phoenix tolerates well",
      normalPortion: "1 to 1.5 cups per meal, adjusted gently",
      mealSchedule: "Breakfast, dinner, and a small bedtime snack",
      toppers: "Warm water or gentle topper only when needed",
      supplements: "Only vet-approved supplements",
      bedtimeSnack: "Small snack before sleep to reduce long empty-stomach windows",
      treatsAllowed: "Training treats and simple chews",
      avoid: "Rich table scraps and sudden food changes",
      sensitivities: "Food anxiety and long meal gaps",
      appetiteQuirks: "Eats best when the house is calm and nobody pressures her",
      vetNotes: "Track appetite, refused meals, and yellow bile patterns for vet review",
    },
    routines: [
      { id: "routine_breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Whoever is up first", note: "Small calm meal; avoid pressure if Phoenix is anxious." },
      { id: "routine_morning_walk", label: "Morning walk", type: "walk", time: "8:15 AM", owner: "Apollo", note: "Decompress walk, sniffing encouraged." },
      { id: "routine_bedtime_snack", label: "Bedtime snack", type: "treat", time: "10:00 PM", owner: "Either caregiver", note: "Small snack may help reduce empty-stomach bile mornings." },
    ],
    goals: [
      { id: "goal_weight_stability", category: "weight", title: "Stable weight gain", target: "Move toward 58 lb with vet-guided pacing", status: "active", due: "Monthly", note: "Use gentle trend tracking; do not force sudden food changes." },
    ],
    records: [
      { id: "record_vet_baseline", type: "vet", title: "Next vet discussion", due: "Next regular appointment", note: "Mention occasional yellow bile vomiting, appetite anxiety, weight goal, and any frequency changes." },
    ],
    entries: [
      { id: "entry_demo_1", type: "meal", title: "Breakfast", caregiver: "Apollo", amount: "1 cup", mood: "settled", note: "Ate after a calm start.", occurredAt: "2026-07-01T05:00:00.000Z" },
      { id: "entry_demo_2", type: "walk", title: "Morning walk", caregiver: "Apollo", durationMinutes: 22, note: "Loose leash, sniffed calmly.", occurredAt: "2026-07-01T06:00:00.000Z" },
      { id: "entry_demo_3", type: "vomit", title: "Yellow bile", caregiver: "Apollo", severity: "watch", note: "Small amount before breakfast. Normal energy after.", occurredAt: "2026-07-01T08:00:00.000Z" },
    ],
  };
}

test("an untouched legacy install imports nothing - factory fiction stays out", () => {
  assert.equal(convertLegacyState(factoryState()), null);
});

test("real owner data imports; demo rows around it are filtered", () => {
  const legacy = factoryState();
  legacy.profile.name = "Biscuit";
  legacy.profile.publicLabel = "Biscuit";
  legacy.entries.push(
    { id: "entry_real_1", type: "meal", title: "Dinner", caregiver: "Sam", amount: "2 cups", note: "Ate everything.", occurredAt: "2026-07-02T01:00:00.000Z" } as (typeof legacy.entries)[number],
    { id: "entry_real_2", type: "walk", title: "Evening loop", caregiver: "Sam", durationMinutes: 30, occurredAt: "2026-07-02T02:30:00.000Z" } as (typeof legacy.entries)[number],
  );
  // The owner edited one default routine: edits are real intent.
  legacy.routines[0] = { ...legacy.routines[0], time: "6:45 AM" };

  const result = convertLegacyState(legacy);
  assert.ok(result);
  assert.equal(result.summary.entries, 2);
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["entry_real_2", "entry_real_1"], // newest first
  );
  assert.equal(result.entries[0].syncStatus, "local");
  assert.equal(result.entries[0].details?.importedFrom, "web-v1");
  // Only the edited routine crosses; the pristine default does not.
  assert.deepEqual(result.docPatch.routines?.map((routine) => routine.id), ["routine_breakfast"]);
  assert.equal(result.docPatch.routines?.[0].time, "6:45 AM");
  // Renamed profile crosses; untouched diet, demo goal, demo record do not.
  assert.equal(result.docPatch.profile?.name, "Biscuit");
  assert.equal(result.docPatch.dietProfile, undefined);
  assert.equal(result.docPatch.goals, undefined);
  assert.equal(result.docPatch.records, undefined);
  assert.equal(result.docPatch.caregivers, undefined);
});

test("legacy profile import keeps the canonical Dog Profile identity", () => {
  const placeholder = factoryState();
  placeholder.profile.name = "My Dog";
  placeholder.profile.publicLabel = "  My Dog  ";
  placeholder.profile.breed = "Cattle dog mix";

  const placeholderResult = convertLegacyState(placeholder);
  assert.ok(placeholderResult);
  assert.equal(placeholderResult.docPatch.profile?.name, "Phoenix");
  assert.equal(placeholderResult.docPatch.profile?.publicLabel, "Phoenix");

  const renamed = factoryState();
  renamed.profile.name = "  Luna  ";
  renamed.profile.publicLabel = "  Luna  ";
  renamed.profile.breed = "Cattle dog mix";

  const renamedResult = convertLegacyState(renamed);
  assert.ok(renamedResult);
  assert.equal(renamedResult.docPatch.profile?.name, "Luna");
  assert.equal(renamedResult.docPatch.profile?.publicLabel, "Luna");
});

test("legacy Private visibility survives as details.householdVisible=false", () => {
  const legacy = factoryState();
  legacy.entries = [
    { id: "e1", type: "note", title: "Private worry", caregiver: "Apollo", note: "Keep to myself.", visibility: "Private", occurredAt: "2026-07-02T01:00:00.000Z" },
    { id: "e2", type: "note", title: "Shared note", caregiver: "Apollo", note: "For everyone.", visibility: "Household", occurredAt: "2026-07-02T02:00:00.000Z" },
  ] as typeof legacy.entries;

  const result = convertLegacyState(legacy);
  assert.ok(result);
  const byId = new Map(result.entries.map((entry) => [entry.id, entry]));
  assert.equal(byId.get("e1")?.details?.householdVisible, false);
  assert.equal("householdVisible" in (byId.get("e2")?.details ?? {}), false);
});

test("meal lifecycle fields land in details; malformed rows are dropped", () => {
  const legacy = factoryState();
  legacy.entries = [
    {
      id: "meal1", type: "meal", title: "Lunch", caregiver: "Apollo",
      portionOffered: "1 cup", portionEaten: "all of it", appetite: "eager",
      food: "Chicken kibble", occurredAt: "2026-07-02T01:00:00.000Z",
    },
    { id: "broken", type: "meal", title: "No date", caregiver: "Apollo", occurredAt: "not-a-date" },
    null,
  ] as unknown as typeof legacy.entries;

  const result = convertLegacyState(legacy);
  assert.ok(result);
  assert.equal(result.entries.length, 1);
  const meal = result.entries[0];
  assert.equal(meal.details?.portionOffered, "1 cup");
  assert.equal(meal.details?.portionEaten, "all of it");
  assert.equal(meal.details?.appetite, "eager");
  assert.equal(meal.food, "Chicken kibble");
});

test("parseLegacyState rejects garbage, wrong shapes, and empty input", () => {
  assert.equal(parseLegacyState(null), null);
  assert.equal(parseLegacyState(""), null);
  assert.equal(parseLegacyState("{not json"), null);
  assert.equal(parseLegacyState('"a string"'), null);
  assert.equal(parseLegacyState('{"someOtherApp":true}'), null);
  assert.ok(parseLegacyState(JSON.stringify(factoryState())));
});
