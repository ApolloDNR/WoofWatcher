import assert from "node:assert/strict";
import test from "node:test";

import type { SetupWizardDraft } from "./setupWizard.ts";

function makeDraft(
  overrides: Partial<SetupWizardDraft> = {},
): SetupWizardDraft {
  return {
    dogName: "Luna",
    breed: "Shepherd",
    weight: "48",
    weightUnit: "lb",
    careFocus: "Mobility",
    caregiverName: "Apollo",
    caregiverRole: "Primary caregiver",
    householdMode: "local",
    householdName: "Luna's Household",
    inviteCode: "",
    primaryFood: "Kibble",
    normalPortion: "1 cup",
    mealSchedule: "Twice daily",
    routineType: "meal",
    routineLabel: "Breakfast",
    routineTime: "08:00",
    ...overrides,
  };
}

async function loadRebaseHelpers() {
  const module = await import("./setupDraftRebase.ts").catch(() => null);
  assert.ok(module, "the Setup draft rebase helper must exist");
  return module;
}

test("same-pet Care changes refresh untouched fields without losing owner edits", async () => {
  const { rebaseSetupDraft } = await loadRebaseHelpers();
  const base = makeDraft();
  const ownerDraft = makeDraft({ dogName: " Luna Bean " });
  const latestCareDraft = makeDraft({
    breed: "German Shepherd",
    primaryFood: "Fresh food",
  });

  const result = rebaseSetupDraft({
    base,
    draft: ownerDraft,
    dirtyFields: ["dogName"],
    latest: latestCareDraft,
  });

  assert.equal(result.draft.dogName, " Luna Bean ");
  assert.equal(result.draft.breed, "German Shepherd");
  assert.equal(result.draft.primaryFood, "Fresh food");
  assert.deepEqual(result.dirtyFields, ["dogName"]);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.base, latestCareDraft);
});

test("overlapping same-field Care and owner changes fail closed for explicit review", async () => {
  const { rebaseSetupDraft } = await loadRebaseHelpers();
  const base = makeDraft();
  const result = rebaseSetupDraft({
    base,
    draft: makeDraft({ breed: "Belgian Shepherd" }),
    dirtyFields: ["breed"],
    latest: makeDraft({ breed: "German Shepherd" }),
  });

  assert.equal(
    result.draft.breed,
    "Belgian Shepherd",
    "the owner's unsaved value stays visible while saving is blocked",
  );
  assert.deepEqual(result.dirtyFields, ["breed"]);
  assert.deepEqual(result.conflicts, ["breed"]);
  assert.equal(result.base.breed, "German Shepherd");
});

test("a Care value that already matches the owner edit is no longer dirty", async () => {
  const { rebaseSetupDraft } = await loadRebaseHelpers();
  const base = makeDraft();
  const result = rebaseSetupDraft({
    base,
    draft: makeDraft({ breed: "German Shepherd" }),
    dirtyFields: ["breed"],
    latest: makeDraft({ breed: "German Shepherd" }),
  });

  assert.deepEqual(result.dirtyFields, []);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.draft.breed, "German Shepherd");
});

test("Care source fingerprints ignore timestamps but include version and profile changes", async () => {
  const {
    createSetupCareDocumentFingerprint,
    createSetupCareSourceFingerprint,
  } = await loadRebaseHelpers();
  const first = {
    version: 7,
    updatedAt: "2026-08-01T00:00:00.000Z",
    activePetId: "dog-a",
    profile: { name: "Luna", breed: "Shepherd" },
    householdSetup: { updatedAt: "2026-08-01T00:00:00.000Z" },
    entries: [{ id: "log-a" }],
  };
  const timestampOnly = {
    ...first,
    updatedAt: "2026-08-02T00:00:00.000Z",
    householdSetup: { updatedAt: "2026-08-02T00:00:00.000Z" },
    entries: [{ id: "log-b" }],
  };

  assert.equal(
    createSetupCareSourceFingerprint(first),
    createSetupCareSourceFingerprint(timestampOnly),
  );
  assert.equal(
    createSetupCareDocumentFingerprint(first),
    createSetupCareDocumentFingerprint(timestampOnly),
  );
  assert.notEqual(
    createSetupCareSourceFingerprint(first),
    createSetupCareSourceFingerprint({ ...timestampOnly, version: 8 }),
  );
  assert.equal(
    createSetupCareDocumentFingerprint(first),
    createSetupCareDocumentFingerprint({ ...timestampOnly, version: 8 }),
    "an exact provider echo may advance its version without changing the accepted Care document",
  );
  assert.notEqual(
    createSetupCareSourceFingerprint(first),
    createSetupCareSourceFingerprint({
      ...timestampOnly,
      profile: { name: "Luna", breed: "German Shepherd" },
    }),
  );
});
