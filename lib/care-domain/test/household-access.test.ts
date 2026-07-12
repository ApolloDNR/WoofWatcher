import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveHouseholdAccessPlan } from "../src/index.ts";

test("derives household access from synced members, local caregivers, and routine owners", () => {
  const plan = deriveHouseholdAccessPlan({
    household: { name: "Phoenix House", inviteCode: "PHX123" },
    members: [
      { displayName: "Apollo", email: "apollo@example.com", role: "owner" },
      { displayName: "Emma", email: "emma@example.com", role: "member" },
    ],
    caregivers: [
      { name: "Emma", role: "Primary caregiver" },
      { name: "Jordan", role: "Walker" },
    ],
    routines: [
      { label: "Breakfast", owner: "Emma" },
      { label: "Morning walk", owner: "Jordan" },
      { label: "Bedtime meds", owner: "Maya" },
    ],
  });

  assert.equal(plan.status, "needs-invites");
  assert.equal(plan.householdName, "Phoenix House");
  assert.equal(plan.inviteCode, "PHX123");
  assert.equal(plan.syncedMembers, 2);
  assert.equal(plan.localOnlyCaregivers, 2);
  assert.equal(plan.routineOnlyOwners, 1);
  assert.deepEqual(
    plan.people.map((person) => ({
      name: person.name,
      role: person.role,
      source: person.source,
      needsInvite: person.needsInvite,
      routineCount: person.routineCount,
    })),
    [
      { name: "Apollo", role: "Owner", source: "account", needsInvite: false, routineCount: 0 },
      { name: "Emma", role: "Primary caregiver", source: "account", needsInvite: false, routineCount: 1 },
      { name: "Jordan", role: "Walker", source: "care-doc", needsInvite: true, routineCount: 1 },
      { name: "Maya", role: "Routine owner", source: "routine-owner", needsInvite: true, routineCount: 1 },
    ],
  );
  assert.deepEqual(plan.people.find((person) => person.name === "Apollo")?.permissions, [
    "Manage household",
    "Edit care plan",
    "Log care",
    "View reports",
  ]);
  assert.match(plan.nextStep, /Invite Jordan/);
  assert.match(plan.summary, /2 synced/);
});

test("prompts household setup before invites exist", () => {
  const plan = deriveHouseholdAccessPlan({
    household: null,
    members: [],
    caregivers: [{ name: "Apollo", role: "Owner" }],
    routines: [],
  });

  assert.equal(plan.status, "needs-household");
  assert.equal(plan.canShareInvite, false);
  assert.equal(plan.people[0].needsInvite, true);
  assert.match(plan.nextStep, /Create or join a household/);
});

test("reports ready access when household members and care team are synced", () => {
  const plan = deriveHouseholdAccessPlan({
    household: { name: "Phoenix House", inviteCode: "PHX123" },
    members: [
      { displayName: "Apollo", email: "apollo@example.com", role: "owner" },
      { displayName: "Emma", email: "emma@example.com", role: "member" },
    ],
    caregivers: [
      { name: "Apollo", role: "Owner" },
      { name: "Emma", role: "Primary caregiver" },
    ],
    routines: [{ label: "Dinner", owner: "Emma" }],
  });

  assert.equal(plan.status, "ready");
  assert.equal(plan.localOnlyCaregivers, 0);
  assert.equal(plan.routineOnlyOwners, 0);
  assert.match(plan.nextStep, /Keep roles current/);
});
