import test from "node:test";
import assert from "node:assert/strict";

import { buildBackendSchemaPlan, buildBackendSeedDraft } from "./woof-backend-schema.js";
import { getDefaultState } from "./woof-core.js";

const NOW = "2026-08-12T18:00:00.000Z";

test("backend schema planning metadata stays dog-generic before a profile seed is reviewed", () => {
  const plan = buildBackendSchemaPlan();
  const serializedPlan = JSON.stringify(plan);

  assert.doesNotMatch(serializedPlan, /Phoenix/);
  assert.match(plan.tables.find((table) => table.name === "pets").description, /Dog profile/);
  assert.match(plan.rlsPolicies.find((policy) => policy.table === "care_entries").summary, /dog care entries/);
  assert.match(plan.migrationSteps.join(" "), /private dog data/);
  assert.match(plan.secretPolicy.join(" "), /dog-specific data/);
});

test("backend seed drafts resolve the Dog Profile identity before creating durable rows", () => {
  const placeholderState = getDefaultState(NOW);
  const placeholderDraft = buildBackendSeedDraft(
    {
      ...placeholderState,
      profile: {
        ...placeholderState.profile,
        name: "My Dog",
        publicLabel: "My Dog",
      },
    },
    { householdId: "household_1" },
    NOW,
  );

  assert.equal(placeholderDraft.pet.name, "Phoenix");
  assert.equal(placeholderDraft.household.label, "Phoenix household");
  assert.equal(placeholderDraft.rows.pets[0].name, "Phoenix");
  assert.equal(placeholderDraft.rows.pets[0].profile_json.name, "Phoenix");
  assert.equal(placeholderDraft.rows.pets[0].profile_json.publicLabel, "Phoenix");
  assert.match(placeholderDraft.auditEvent.summary, /Phoenix/);

  const renamedDraft = buildBackendSeedDraft(
    {
      ...placeholderState,
      profile: {
        ...placeholderState.profile,
        name: "  Mochi  ",
        publicLabel: "  Mochi  ",
      },
    },
    { householdId: "household_2" },
    NOW,
  );

  assert.equal(renamedDraft.pet.name, "Mochi");
  assert.equal(renamedDraft.rows.pets[0].profile_json.publicLabel, "Mochi");
  assert.equal(renamedDraft.rows.households[0].privacy_mode, "private_dog");
  assert.doesNotMatch(JSON.stringify(renamedDraft), /private_phoenix/);
});

test("backend seed drafts exclude owner-private and legacy-hidden logs from household rows", () => {
  const state = getDefaultState(NOW);
  const sharedEntry = {
    id: "shared-walk",
    type: "walk",
    title: "Shared morning walk",
    caregiver: "Avery",
    occurredAt: NOW,
  };
  const privateEntry = {
    id: "private-health",
    type: "health",
    title: "Private health note",
    note: "Owner-only detail",
    caregiver: "Avery",
    occurredAt: NOW,
    visibility: "Private",
  };
  const legacyHiddenEntry = {
    id: "legacy-hidden-training",
    type: "training",
    title: "Legacy hidden training note",
    caregiver: "Avery",
    occurredAt: NOW,
    householdVisible: false,
  };

  const draft = buildBackendSeedDraft(
    { ...state, entries: [sharedEntry, privateEntry, legacyHiddenEntry] },
    { householdId: "household_3" },
    NOW,
  );

  assert.deepEqual(draft.rows.care_entries.map((entry) => entry.id), ["shared-walk"]);
  assert.doesNotMatch(JSON.stringify(draft.rows.care_entries), /Private health note|Owner-only detail|Legacy hidden training note/);
});
