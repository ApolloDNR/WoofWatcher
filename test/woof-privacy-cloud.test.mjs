import assert from "node:assert/strict";
import test from "node:test";
import { createEntry, getDefaultState } from "../src/woof-core.js";
import {
  buildCaregiverAccessModel,
  buildCloudSyncPlan,
  buildScopedCarePass,
  createCaregiverInviteDraft
} from "../src/woof-privacy-cloud.js";

const NOW = "2026-06-05T18:00:00.000Z";

test("builds scoped Care Passes without exporting raw local state by default", () => {
  const state = {
    ...getDefaultState(NOW),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-05T14:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", occurredAt: "2026-06-05T15:00:00.000Z" })
    ]
  };

  const vetPass = buildScopedCarePass(state, { audience: "vet" }, NOW);
  const sitterPass = buildScopedCarePass(state, { audience: "sitter" }, NOW);

  assert.equal(vetPass.packageType, "woofwatcher.care-pass");
  assert.equal(vetPass.audience, "vet");
  assert.equal(vetPass.privacy.includesFullState, false);
  assert.equal("state" in vetPass, false);
  assert.ok(vetPass.sections.includes("healthWatch"));
  assert.ok(vetPass.sections.includes("records"));
  assert.match(vetPass.boundary, /not a diagnosis/i);

  assert.equal(sitterPass.audience, "sitter");
  assert.ok(sitterPass.sections.includes("routines"));
  assert.ok(sitterPass.sections.includes("dietProfile"));
  assert.equal(sitterPass.sections.includes("fullMedicalRecords"), false);
});

test("creates caregiver invite drafts without generating fake auth tokens", () => {
  const invite = createCaregiverInviteDraft(
    {
      recipientName: "Weekend sitter",
      recipientEmail: "sitter@example.com",
      role: "sitter",
      scopes: ["routine_read", "entry_create", "care_pass_read", "records_read"]
    },
    NOW
  );

  assert.equal(invite.packageType, "woofwatcher.invite-draft");
  assert.equal(invite.status, "draft_not_sent");
  assert.equal(invite.role, "sitter");
  assert.deepEqual(invite.scopes, ["routine_read", "entry_create", "care_pass_read"]);
  assert.equal("token" in invite, false);
  assert.match(invite.privacyNotice, /private Phoenix care/i);
});

test("builds a caregiver access model with explicit privacy and permission roles", () => {
  const model = buildCaregiverAccessModel(getDefaultState(NOW), NOW);

  assert.equal(model.household.status, "local_only");
  assert.ok(model.roles.some((role) => role.id === "owner" && role.scopes.includes("records_write")));
  assert.ok(model.roles.some((role) => role.id === "vet" && !role.scopes.includes("entry_create")));
  assert.ok(model.members.some((member) => member.name === "Apollo" && member.role === "owner"));
  assert.match(model.privacyBoundary, /invite-only/i);
});

test("builds a cloud sync plan that is honest about missing backend pieces", () => {
  const state = {
    ...getDefaultState(NOW),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", occurredAt: "2026-06-05T14:00:00.000Z" }),
      createEntry({ type: "walk", title: "Walk", occurredAt: "2026-06-05T15:00:00.000Z" })
    ]
  };

  const localPlan = buildCloudSyncPlan(state, {}, NOW);
  const readyPlan = buildCloudSyncPlan(state, { backendConfigured: true, householdId: "household_phoenix" }, NOW);

  assert.equal(localPlan.status, "local_only");
  assert.ok(localPlan.blockers.includes("Choose and configure a backend before enabling cross-device sync."));
  assert.equal(localPlan.pendingLocalCounts.entries, 2);
  assert.ok(localPlan.resources.some((resource) => resource.name === "care_entries" && resource.containsPrivateData));
  assert.match(localPlan.conflictPolicy, /newest edit wins/i);

  assert.equal(readyPlan.status, "ready_to_connect");
  assert.equal(readyPlan.blockers.length, 0);
  assert.equal(readyPlan.householdId, "household_phoenix");
});
