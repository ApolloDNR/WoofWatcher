import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCarePass, createCarePassArtifact } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T15:00:00-07:00").getTime();

function baseInput() {
  return {
    now: NOW,
    profile: {
      name: "Phoenix",
      breed: "German Shepherd mix",
      weight: { current: 68, unit: "lb" },
      careFocus: "Keep meals calm and track yellow bile vomiting.",
      vetBoundary: "Track patterns for caregiver and vet review. This is not a diagnosis.",
    },
    dietProfile: {
      primaryFood: "Sensitive stomach kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
      bedtimeSnack: "Small kibble snack",
      avoid: "Rich treats",
      appetiteQuirks: "Eats better when the house is calm.",
    },
    caregivers: [
      { name: "Emma", role: "Primary" },
      { name: "Apollo", role: "Caregiver" },
    ],
    routines: [
      { id: "breakfast", type: "meal", label: "Breakfast", time: "7:00 AM", owner: "Emma" },
      { id: "walk", type: "walk", label: "Walk", time: "8:30 AM", owner: "Apollo" },
      { id: "dinner", type: "meal", label: "Dinner", time: "6:00 PM", owner: "Emma" },
    ],
    records: [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "May 2026", note: "Up to date" },
    ],
    entries: [
      {
        id: "meal_1",
        type: "meal",
        title: "Breakfast",
        caregiver: "Emma",
        occurredAt: "2026-06-06T14:00:00.000Z",
      },
      {
        id: "walk_1",
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T14:30:00.000Z",
        durationMinutes: 25,
      },
      {
        id: "vomit_1",
        type: "vomit",
        title: "Yellow bile",
        caregiver: "Emma",
        occurredAt: "2026-06-06T13:00:00.000Z",
        severity: "watch",
        details: { kind: "yellow bile" },
      },
    ],
  };
}

test("builds a sitter care pass with routine, diet, and next action context", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "sitter" });

  assert.equal(pass.audience, "sitter");
  assert.match(pass.title, /Sitter Care Pass/);
  assert.match(pass.message, /Phoenix/);
  assert.match(pass.message, /Dinner at 6:00 PM/);
  assert.match(pass.message, /Sensitive stomach kibble/);
  assert.match(pass.message, /Small kibble snack/);
  assert.match(pass.message, /Keep meals calm/);
});

test("builds a vet care pass with health signals and records", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "vet" });

  assert.match(pass.title, /Vet Care Pass/);
  assert.match(pass.message, /Yellow bile/);
  assert.match(pass.message, /Health watch/);
  assert.match(pass.message, /Rabies/);
  assert.match(pass.message, /not a diagnosis/i);
});

test("trainer care pass emphasizes behavior and activity context", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "trainer" });

  assert.match(pass.message, /Training focus/);
  assert.match(pass.message, /Morning walk/);
  assert.match(pass.message, /Eats better when the house is calm/);
});

test("creates a stable report artifact snapshot from a care pass", () => {
  const pass = buildCarePass({ ...baseInput(), audience: "vet" });
  const artifact = createCarePassArtifact(pass, "2026-06-08T06:30:00.000Z");

  assert.equal(artifact.id, "care_pass_vet_2026-06-08T06-30-00-000Z");
  assert.equal(artifact.audience, "vet");
  assert.equal(artifact.title, pass.title);
  assert.equal(artifact.createdAt, "2026-06-08T06:30:00.000Z");
  assert.equal(artifact.summary, pass.summary);
  assert.equal(artifact.message, pass.message);
  assert.deepEqual(artifact.sectionTitles, pass.sections.map((section) => section.title));
});
