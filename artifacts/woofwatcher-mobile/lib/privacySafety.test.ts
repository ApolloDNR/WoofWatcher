import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAccountDeletionRequest,
  buildPrivacyExportBundle,
  deriveAccountSafetyPlan,
  serializePrivacyExportBundle,
} from "./privacySafety.ts";

const NOW = new Date("2026-06-08T14:00:00.000Z").getTime();

const state = {
  activePetId: "primary",
  profile: {
    name: "Phoenix",
    breed: "German Shepherd mix",
    vetBoundary: "WoofWatcher is not a veterinary diagnosis.",
  },
  pets: [{ id: "pet_london", name: "London", breed: "Golden Retriever", status: "provider-gated" }],
  accessPasses: [{ id: "access_maya", holderName: "Maya", role: "Sitter", status: "draft" }],
  caregivers: [{ name: "Apollo", role: "Owner" }],
  dietProfile: { primaryFood: "Sensitive kibble", normalPortion: "1 cup" },
  routines: [{ id: "breakfast", label: "Breakfast", type: "meal", time: "7:30 AM", owner: "Apollo" }],
  goals: [{ id: "weight", title: "Hold steady weight" }],
  records: [
    { id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028", attachmentName: "rabies.pdf" },
    { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
  ],
  calendarEvents: [{ id: "renewal", title: "Renew insurance", date: "2026-07-01", type: "insurance" }],
  reportArtifacts: [
    {
      id: "sitter",
      kind: "care_pass",
      audience: "sitter",
      title: "Phoenix Sitter Care Pass",
      message: "Care pass",
      printFileName: "phoenix-sitter-care-pass-2026-06-08.html",
      printHtml: "<!doctype html><html><body>Care pass</body></html>",
    },
  ],
  entries: [
    {
      id: "meal_1",
      type: "meal",
      title: "Breakfast",
      caregiver: "Apollo",
      occurredAt: "2026-06-08T14:00:00.000Z",
      details: { expectedPortion: "1 cup", householdVisible: true },
    },
  ],
};

test("builds an owner export bundle with counts and care data", () => {
  const bundle = buildPrivacyExportBundle(
    state,
    { userId: "user_123", householdId: "house_123", householdName: "Phoenix House" },
    NOW,
  );

  assert.equal(bundle.app, "WoofWatcher");
  assert.equal(bundle.generatedAt, "2026-06-08T14:00:00.000Z");
  assert.equal(bundle.dogName, "Phoenix");
  assert.deepEqual(bundle.counts, {
    caregivers: 1,
    pets: 1,
    accessPasses: 1,
    routines: 1,
    entries: 1,
    records: 2,
    reportArtifacts: 1,
    calendarEvents: 1,
    attachedDocuments: 1,
  });
  assert.equal(bundle.care.profile?.name, "Phoenix");
  assert.equal(bundle.care.activePetId, "primary");
  assert.equal(bundle.care.pets[0]?.name, "London");
  assert.equal((bundle.care.accessPasses[0] as { holderName?: string })?.holderName, "Maya");
  assert.equal(bundle.care.entries[0]?.id, "meal_1");
  assert.deepEqual(bundle.care.reportArtifacts[0], state.reportArtifacts[0]);
  assert.match(bundle.disclosures.ai, /not a veterinary diagnosis/i);
});

test("serializes export without auth tokens or secrets", () => {
  const bundle = buildPrivacyExportBundle(
    {
      ...state,
      sessionToken: "should-not-export",
      authToken: "should-not-export",
    },
    { userId: "user_123" },
    NOW,
  );

  const text = serializePrivacyExportBundle(bundle);

  assert.match(text, /"dogName": "Phoenix"/);
  assert.doesNotMatch(text, /should-not-export|authToken|sessionToken/i);
});

test("derives launch safety plan before storage, deletion, AI, and payments are enabled", () => {
  const plan = deriveAccountSafetyPlan({
    state,
    aiProviderConfigured: false,
    storageProviderConfigured: false,
    accountDeletionEnabled: false,
    paymentsEnabled: false,
  });

  assert.equal(plan.export.status, "ready");
  assert.equal(plan.accountDeletion.status, "manual_required");
  assert.equal(plan.aiDisclosure.status, "limited");
  assert.equal(plan.documentStorage.status, "blocked");
  assert.equal(plan.payments.status, "blocked");
  assert.ok(plan.launchBlockers.some((blocker) => /account deletion/i.test(blocker)));
  assert.ok(plan.launchBlockers.some((blocker) => /document storage/i.test(blocker)));
});

test("builds a non-destructive account deletion request", () => {
  const request = buildAccountDeletionRequest(
    state,
    { userId: "user_123", householdId: "house_123", householdName: "Phoenix House" },
    NOW,
  );

  assert.match(request.subject, /Account deletion request/);
  assert.match(request.body, /Phoenix/);
  assert.match(request.body, /user_123/);
  assert.match(request.body, /manual review/i);
  assert.match(request.body, /Export data before deletion/i);
  assert.match(request.body, /pet roster slots/i);
  assert.match(request.body, /Access Pass drafts/i);
});
