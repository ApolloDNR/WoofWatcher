import assert from "node:assert/strict";
import test from "node:test";

import { createEntry, getDefaultState } from "../src/woof-core.js";
import {
  buildBackendSchemaPlan,
  buildBackendSeedDraft
} from "../src/woof-backend-schema.js";

const NOW = "2026-06-05T10:30:00.000";

test("builds a provider-neutral schema plan for private caregiver sync", () => {
  const plan = buildBackendSchemaPlan({ provider: "supabase" }, NOW);
  const tableNames = plan.tables.map((table) => table.name);
  const careEntries = plan.tables.find((table) => table.name === "care_entries");
  const serialized = JSON.stringify(plan);

  assert.equal(plan.packageType, "woofwatcher.backend-schema-plan");
  assert.equal(plan.provider, "supabase");
  assert.ok(tableNames.includes("households"));
  assert.ok(tableNames.includes("members"));
  assert.ok(tableNames.includes("pets"));
  assert.ok(tableNames.includes("care_entries"));
  assert.ok(tableNames.includes("audit_events"));
  assert.ok(tableNames.includes("nudge_jobs"));
  assert.ok(tableNames.includes("report_artifacts"));
  assert.ok(careEntries.columns.some((column) => column.name === "household_id"));
  assert.ok(careEntries.columns.some((column) => column.name === "occurred_at"));
  assert.ok(plan.rlsPolicies.some((policy) => /household members/i.test(policy.summary)));
  assert.doesNotMatch(serialized, /OPENAI_API_KEY|service_role|secret-token/i);
});

test("builds a backend seed draft without applying writes", () => {
  const state = {
    ...getDefaultState(NOW),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-05T07:45:00.000" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Girlfriend", durationMinutes: 20, occurredAt: "2026-06-05T08:30:00.000" })
    ]
  };

  const draft = buildBackendSeedDraft(
    state,
    {
      householdId: "household_phoenix",
      actor: "Apollo"
    },
    NOW
  );

  assert.equal(draft.packageType, "woofwatcher.backend-seed-draft");
  assert.equal(draft.status, "ready_to_review");
  assert.equal(draft.applied, false);
  assert.equal(draft.household.id, "household_phoenix");
  assert.equal(draft.rowCounts.care_entries, 2);
  assert.equal(draft.rowCounts.routines, state.routines.length);
  assert.equal(draft.rows.care_entries[0].household_id, "household_phoenix");
  assert.equal(draft.rows.care_entries[0].pet_id, "pet_phoenix");
  assert.equal(draft.auditEvent.action, "sync_plan");
  assert.equal(draft.blockers.length, 0);
});

test("blocks seed drafts until a household id exists", () => {
  const draft = buildBackendSeedDraft(getDefaultState(NOW), {}, NOW);

  assert.equal(draft.status, "blocked");
  assert.equal(draft.applied, false);
  assert.ok(draft.blockers.includes("Create a household id before preparing backend seed rows."));
  assert.equal(draft.rows.care_entries.length, 0);
});
