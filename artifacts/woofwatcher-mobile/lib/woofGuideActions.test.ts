import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveWoofGuideActions,
  deriveWoofGuideVetNoteAction,
  resolveWoofGuideAssistantGate,
  WOOFGUIDE_ASSISTANT_FALLBACK_LINKS,
} from "./woofGuideActions.ts";

const NOW = new Date("2026-06-06T15:00:00-07:00").getTime();

test("prioritizes a vet-note action for active health watch signals", () => {
  const actions = deriveWoofGuideActions(
    {
      profile: { name: "Phoenix" },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      routines: [{ id: "dinner", type: "meal", label: "Dinner", time: "6:00 PM" }],
      records: [
        { id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2027" },
        { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
        { id: "insurance", type: "insurance", title: "Lemonade", due: "Jun 1, 2027" },
      ],
      entries: [
        {
          id: "vomit",
          type: "vomit",
          title: "Yellow bile",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T14:00:00.000Z",
          severity: "watch",
          details: { kind: "yellow bile" },
        },
      ],
    },
    NOW,
  );

  assert.equal(actions[0].id, "vet-note");
  assert.equal(actions[0].urgency, "watch");
  assert.match(actions[0].prompt ?? "", /Phoenix/);
  assert.equal(actions[0].draft?.kind, "vet_note");
  assert.match(actions[0].draft?.body ?? "", /Health Pattern Review/i);
  assert.match(actions[0].draft?.body ?? "", /not a diagnosis/i);
  assert.deepEqual(actions[0].draft?.sourceEntryIds, ["vomit"]);
});

test("surfaces records review for missing or expired credential records", () => {
  const actions = deriveWoofGuideActions(
    {
      profile: { name: "Phoenix" },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      routines: [{ id: "walk", type: "walk", label: "Walk", time: "8:00 AM" }],
      records: [{ id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2026" }],
      entries: [],
    },
    NOW,
  );

  const recordAction = actions.find((action) => action.id === "records-review");
  assert.equal(recordAction?.route, "/records");
  assert.equal(recordAction?.urgency, "alert");
  assert.equal(recordAction?.draft?.kind, "reminder");
  assert.match(recordAction?.draft?.body ?? "", /Rabies/i);
  assert.equal(recordAction?.draft?.calendarEvent?.source, "woofguide");
});

test("guides setup when diet and routines are missing", () => {
  const actions = deriveWoofGuideActions(
    {
      profile: { name: "Phoenix" },
      dietProfile: {},
      routines: [],
      records: [],
      entries: [],
    },
    NOW,
  );

  assert.deepEqual(
    actions.map((action) => action.id),
    ["records-review", "diet-baseline", "routine-setup", "care-pass"],
  );
});

test("creates an owner-reviewed meal log draft when the first meal is missing", () => {
  const actions = deriveWoofGuideActions(
    {
      profile: { name: "Phoenix" },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      routines: [{ id: "breakfast", type: "meal", label: "Breakfast", time: "7:00 AM", owner: "Emma" }],
      records: [
        { id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028" },
        { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
        { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
      ],
      entries: [],
    },
    NOW,
  );

  const mealAction = actions.find((action) => action.id === "log-meal");
  assert.equal(mealAction?.draft?.kind, "log_entry");
  assert.equal(mealAction?.draft?.title, "Review meal served draft");
  assert.match(mealAction?.draft?.body ?? "", /outcome pending/i);
  assert.equal(mealAction?.draft?.entry?.type, "meal");
  assert.equal(mealAction?.draft?.entry?.details?.expectedPortion, "1 cup");
  assert.equal(mealAction?.draft?.entry?.details?.mealCompletion, "served");
  assert.equal(mealAction?.draft?.entry?.details?.mealLifecycle, "outcome-pending");
  assert.equal(mealAction?.draft?.entry?.details?.requiresOutcomeUpdate, true);
  assert.equal(mealAction?.draft?.entry?.details?.householdVisible, true);
});

test("keeps the assistant gated off until provider proof and an API domain exist", () => {
  const noProof = resolveWoofGuideAssistantGate({
    apiBaseUrl: "https://example.com",
    liveAiProofReady: false,
  });
  assert.equal(noProof.enabled, false);
  assert.equal(noProof.reason, "provider-proof-missing");
  assert.equal(noProof.statusLabel, "Not in this build");
  assert.match(noProof.headline, /isn't enabled in this build/);
  assert.match(noProof.privacyNote, /Nothing you type here is sent anywhere/);
  assert.doesNotMatch(noProof.headline, /try again/i, "the gated state must not pretend the outage is transient");
  assert.doesNotMatch(noProof.composerNote, /try again/i);

  const noDomain = resolveWoofGuideAssistantGate({ apiBaseUrl: "  ", liveAiProofReady: true });
  assert.equal(noDomain.enabled, false);
  assert.equal(noDomain.reason, "api-domain-missing");

  const ready = resolveWoofGuideAssistantGate({
    apiBaseUrl: "https://example.com",
    liveAiProofReady: true,
  });
  assert.equal(ready.enabled, true);
  assert.equal(ready.reason, "ready");
});

test("keeps working non-assistant destinations for the gated WoofGuide state", () => {
  assert.deepEqual(
    WOOFGUIDE_ASSISTANT_FALLBACK_LINKS.map((link) => link.route),
    ["/health", "/records", "/"],
  );
  for (const link of WOOFGUIDE_ASSISTANT_FALLBACK_LINKS) {
    assert.ok(link.label.trim().length > 0);
    assert.ok(link.detail.trim().length > 0);
  }
});

test("builds the owner-reviewed vet-note draft for the Health Watch funnel", () => {
  const action = deriveWoofGuideVetNoteAction(
    {
      profile: { name: "Phoenix" },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      routines: [{ id: "dinner", type: "meal", label: "Dinner", time: "6:00 PM" }],
      records: [],
      entries: [
        {
          id: "vomit",
          type: "vomit",
          title: "Yellow bile",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T14:00:00.000Z",
          severity: "watch",
          details: { kind: "yellow bile" },
        },
      ],
    },
    NOW,
  );

  assert.equal(action.id, "health-review-vet-note");
  assert.equal(action.urgency, "watch");
  assert.equal(action.draft?.kind, "vet_note");
  assert.match(action.draft?.body ?? "", /Health Pattern Review/i);
  assert.match(action.draft?.body ?? "", /not a diagnosis/i);
  assert.equal(action.prompt, undefined, "the funnel draft must not depend on a live assistant prompt");
});
