import { test } from "node:test";
import assert from "node:assert/strict";

import { applySetupWizardDraft, buildSetupConfirmation, createSetupWizardDraft } from "./setupWizard.ts";

const NOW = "2026-06-08T06:00:00.000Z";

function defaultDoc() {
  return {
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    profile: {
      name: "My Dog",
      publicLabel: "My Dog",
      breed: "",
      background: "",
      careFocus: "",
      microchipNumber: "",
      insuranceProvider: "",
      insurancePolicy: "",
      primaryVet: "",
      emergencyContact: "",
      weight: { current: 0, goal: "", unit: "lb" },
      vetBoundary: "Care notes are not veterinary diagnosis.",
    },
    caregivers: [],
    dietProfile: {
      primaryFood: "",
      normalPortion: "",
      mealSchedule: "",
      toppers: "",
      supplements: "",
      bedtimeSnack: "",
      treatsAllowed: "",
      avoid: "",
      sensitivities: "",
      appetiteQuirks: "",
      vetNotes: "",
    },
    routines: [],
    goals: [{ id: "goal-1", category: "weight", title: "Hold steady", target: "68 lb", status: "active", due: "", note: "" }],
    records: [{ id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2027", note: "" }],
    calendarEvents: [],
  };
}

test("applies first-run setup draft while preserving existing care document data", () => {
  const next = applySetupWizardDraft(
    defaultDoc(),
    {
      dogName: "Phoenix",
      breed: "German Shepherd mix",
      weight: "68",
      weightUnit: "lb",
      careFocus: "Support anxious eating and steady routines.",
      caregiverName: "Apollo",
      caregiverRole: "Primary caregiver",
      primaryFood: "Sensitive kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
      routineType: "meal",
      routineLabel: "Breakfast",
      routineTime: "7:30 AM",
    },
    NOW,
  );

  assert.equal(next.updatedAt, NOW);
  assert.equal(next.profile.name, "Phoenix");
  assert.equal(next.profile.publicLabel, "Phoenix");
  assert.equal(next.profile.breed, "German Shepherd mix");
  assert.equal(next.profile.weight.current, 68);
  assert.equal(next.profile.weight.unit, "lb");
  assert.equal(next.profile.careFocus, "Support anxious eating and steady routines.");
  assert.deepEqual(next.caregivers, [{ name: "Apollo", role: "Primary caregiver" }]);
  assert.equal(next.dietProfile.primaryFood, "Sensitive kibble");
  assert.equal(next.dietProfile.normalPortion, "1 cup");
  assert.equal(next.dietProfile.mealSchedule, "7 AM and 6 PM");
  assert.equal(next.routines.length, 1);
  assert.equal(next.routines[0].label, "Breakfast");
  assert.equal(next.routines[0].owner, "Apollo");
  assert.equal(next.goals.length, 1);
  assert.equal(next.records.length, 1);
});

test("creates an editable setup draft from current care state", () => {
  const draft = createSetupWizardDraft({
    ...defaultDoc(),
    profile: {
      ...defaultDoc().profile,
      name: "My Dog",
      breed: "German Shepherd mix",
      weight: { current: 68, goal: "", unit: "lb" },
    },
    caregivers: [{ name: "Emma", role: "Primary" }],
    routines: [{ id: "walk-1", type: "walk", label: "Morning walk", time: "8:30 AM", owner: "Emma", note: "" }],
  });

  assert.equal(draft.dogName, "");
  assert.equal(draft.breed, "German Shepherd mix");
  assert.equal(draft.weight, "68");
  assert.equal(draft.weightUnit, "lb");
  assert.equal(draft.caregiverName, "Emma");
  assert.equal(draft.caregiverRole, "Primary");
  assert.equal(draft.routineType, "walk");
  assert.equal(draft.routineLabel, "Morning walk");
  assert.equal(draft.routineTime, "8:30 AM");
});

test("builds a truthful post-setup confirmation from the saved care foundation", () => {
  const next = applySetupWizardDraft(
    defaultDoc(),
    {
      dogName: "Phoenix",
      breed: "German Shepherd mix",
      weight: "68",
      weightUnit: "lb",
      careFocus: "Support anxious eating and steady routines.",
      caregiverName: "Apollo",
      caregiverRole: "Primary caregiver",
      primaryFood: "Sensitive kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
      routineType: "meal",
      routineLabel: "Breakfast",
      routineTime: "7:30 AM",
    },
    NOW,
  );

  const confirmation = buildSetupConfirmation(next);

  assert.equal(confirmation.title, "Phoenix's care foundation is ready");
  assert.match(confirmation.body, /Breakfast at 7:30 AM/);
  assert.match(confirmation.body, /Apollo/);
  assert.match(confirmation.body, /Sensitive kibble/);
  assert.match(confirmation.body, /Today, Log, Records, reports, and WoofGuide/);
  assert.match(confirmation.nextStep, /household invite and sync controls stay in More/i);
});

test("names the active household in setup confirmation without claiming onboarding sync is complete", () => {
  const next = applySetupWizardDraft(
    defaultDoc(),
    {
      dogName: "Phoenix",
      breed: "German Shepherd mix",
      weight: "68",
      weightUnit: "lb",
      careFocus: "Support anxious eating and steady routines.",
      caregiverName: "Emma",
      caregiverRole: "Sitter",
      primaryFood: "Sensitive kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
      routineType: "walk",
      routineLabel: "Morning walk",
      routineTime: "8:30 AM",
    },
    NOW,
  );

  const confirmation = buildSetupConfirmation(next, {
    activeHouseholdName: "Phoenix Family Pack",
    householdCount: 2,
  });

  assert.match(confirmation.nextStep, /Active household: Phoenix Family Pack/);
  assert.match(confirmation.nextStep, /2 packs in More/);
  assert.match(confirmation.nextStep, /setup only saved the care foundation/i);
  assert.doesNotMatch(confirmation.nextStep, /sync is complete/i);
});
