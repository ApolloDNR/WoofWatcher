import { test } from "node:test";
import assert from "node:assert/strict";

import { applySetupWizardDraft, buildSetupWizardConfirmation, createSetupWizardDraft } from "./setupWizard.ts";

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
    householdSetup: {
      mode: "create",
      householdName: "",
      inviteCode: "",
      providerStatus: "local-only",
    },
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
      householdMode: "create",
      householdName: "Phoenix House",
      inviteCode: "",
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
  assert.deepEqual(next.householdSetup, {
    mode: "create",
    householdName: "Phoenix House",
    inviteCode: "",
    providerStatus: "pending-provider",
    updatedAt: NOW,
  });
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
  assert.equal(draft.householdMode, "create");
  assert.equal(draft.householdName, "Dog household");
  assert.equal(draft.routineType, "walk");
  assert.equal(draft.routineLabel, "Morning walk");
  assert.equal(draft.routineTime, "8:30 AM");
});

test("stages a join-by-invite household plan without pretending remote invites are live", () => {
  const next = applySetupWizardDraft(
    defaultDoc(),
    {
      dogName: "Phoenix",
      breed: "German Shepherd mix",
      weight: "68",
      weightUnit: "lb",
      careFocus: "Coordinate between homes.",
      caregiverName: "Apollo",
      caregiverRole: "Adult Admin",
      householdMode: "join",
      householdName: "Emma's Home",
      inviteCode: " ww-42 ",
      primaryFood: "Sensitive kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
      routineType: "walk",
      routineLabel: "Evening walk",
      routineTime: "5:30 PM",
    },
    NOW,
  );

  assert.equal(next.householdSetup?.mode, "join");
  assert.equal(next.householdSetup?.householdName, "Emma's Home");
  assert.equal(next.householdSetup?.inviteCode, "WW-42");
  assert.equal(next.householdSetup?.providerStatus, "pending-provider");

  const confirmation = buildSetupWizardConfirmation(next, { isClerkConfigured: true, isSignedIn: false });
  assert.match(confirmation.title, /invite/i);
  assert.match(confirmation.detail, /WW-42/);
  assert.match(confirmation.syncLabel, /Account needed/);
  assert.match(confirmation.providerBoundary, /does not send or accept remote invites/i);
});

test("describes local preview setup as device-only until account sync is configured", () => {
  const next = applySetupWizardDraft(
    defaultDoc(),
    {
      dogName: "Phoenix",
      breed: "German Shepherd mix",
      weight: "68",
      weightUnit: "lb",
      careFocus: "Keep a local care baseline.",
      caregiverName: "Apollo",
      caregiverRole: "Primary caregiver",
      householdMode: "local",
      householdName: "",
      inviteCode: "",
      primaryFood: "Sensitive kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
      routineType: "meal",
      routineLabel: "Breakfast",
      routineTime: "7:30 AM",
    },
    NOW,
  );

  assert.equal(next.householdSetup?.mode, "local");
  assert.equal(next.householdSetup?.householdName, "Phoenix's Household");
  assert.equal(next.householdSetup?.providerStatus, "local-only");

  const confirmation = buildSetupWizardConfirmation(next, { isClerkConfigured: false, isSignedIn: false });
  assert.match(confirmation.title, /local/i);
  assert.match(confirmation.syncLabel, /Local preview/);
  assert.match(confirmation.nextActions.join(" "), /backup\/export/i);
});
