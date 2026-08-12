import test from "node:test";
import assert from "node:assert/strict";

import { buildBackendSeedDraft } from "./woof-backend-schema.js";
import { getDefaultState } from "./woof-core.js";

const NOW = "2026-08-12T18:00:00.000Z";

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
});
