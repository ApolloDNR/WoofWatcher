import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCarePass,
  createCarePassArtifact,
  createPetCredentialArtifact,
  createProgressReportArtifact,
} from "../../../lib/care-domain/src/index.ts";
import { deriveWoofGuideActions } from "./woofGuideActions.ts";

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
  assert.equal(mealAction?.draft?.entry?.type, "meal");
  assert.equal(mealAction?.draft?.entry?.details?.expectedPortion, "1 cup");
  assert.equal(mealAction?.draft?.entry?.details?.mealCompletion, "complete");
  assert.equal(mealAction?.draft?.entry?.details?.householdVisible, true);
});

test("creates an owner-reviewed mood summary from shared mood energy logs", () => {
  const actions = deriveWoofGuideActions(
    {
      profile: { name: "Phoenix" },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      routines: [{ id: "walk", type: "walk", label: "Walk", time: "8:00 AM" }],
      records: [
        { id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028" },
        { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
        { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
      ],
      entries: [
        {
          id: "mood-low",
          type: "mood",
          title: "Mood - Visitors",
          caregiver: "Emma",
          mood: "anxious",
          occurredAt: "2026-06-06T18:00:00.000Z",
          details: {
            energyLevel: "low",
            moodContext: "Visitors came by",
            householdVisible: true,
          },
        },
        {
          id: "private-mood",
          type: "mood",
          caregiver: "Apollo",
          mood: "happy",
          occurredAt: "2026-06-06T17:00:00.000Z",
          details: {
            energyLevel: "high",
            householdVisible: false,
          },
        },
      ],
    },
    NOW,
  );

  const moodAction = actions.find((action) => action.id === "mood-summary");

  assert.equal(moodAction?.urgency, "watch");
  assert.equal(moodAction?.draft?.kind, "mood_summary");
  assert.match(moodAction?.detail ?? "", /1 shared mood check-ins/);
  assert.match(moodAction?.draft?.body ?? "", /Mood & Energy Review/);
  assert.match(moodAction?.draft?.body ?? "", /Visitors came by/);
  assert.match(moodAction?.draft?.body ?? "", /owner-reported/i);
  assert.deepEqual(moodAction?.draft?.sourceEntryIds, ["mood-low"]);
});

test("creates an owner-reviewed records attachment prep draft without claiming cloud storage", () => {
  const actions = deriveWoofGuideActions(
    {
      profile: { name: "Phoenix" },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      routines: [{ id: "walk", type: "walk", label: "Walk", time: "8:00 AM" }],
      records: [
        { id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028" },
        { id: "chip", type: "microchip", title: "HomeAgain", due: "985112003004551" },
        { id: "insurance", type: "insurance", title: "Lemonade", due: "Policy WW-1042" },
        {
          id: "receipt-attached",
          type: "receipt",
          title: "Wellness visit receipt",
          attachmentUri: "file:///local/wellness-receipt.pdf",
        },
        { id: "lab-missing", type: "document", title: "Latest lab panel" },
      ],
      entries: [],
    },
    NOW,
  );

  const prepAction = actions.find((action) => action.id === "records-attachment-prep");

  assert.equal(prepAction?.route, "/records");
  assert.equal(prepAction?.urgency, "watch");
  assert.equal(prepAction?.draft?.kind, "records_attachment_prep");
  assert.match(prepAction?.detail ?? "", /1 of 2 receipt\/document records have local files attached/i);
  assert.match(prepAction?.draft?.body ?? "", /Latest lab panel/);
  assert.match(prepAction?.draft?.body ?? "", /saved locally on this device/i);
  assert.match(prepAction?.draft?.safety ?? "", /cloud storage is not enabled/i);
});

test("creates an owner-reviewed Dog ID prep draft from shared credential readiness", () => {
  const actions = deriveWoofGuideActions(
    {
      profile: {
        name: "Phoenix",
        breed: "Shepherd mix",
        primaryVet: "River City Vet",
      },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      caregivers: [{ name: "Apollo", role: "Owner" }],
      routines: [{ id: "walk", type: "walk", label: "Walk", time: "8:00 AM" }],
      records: [{ id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028" }],
      entries: [
        {
          id: "breakfast",
          type: "meal",
          title: "Breakfast",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T14:00:00.000Z",
          details: { householdVisible: true },
        },
      ],
    },
    NOW,
  );

  const dogIdAction = actions.find((action) => action.id === "dog-id-prep");

  assert.equal(dogIdAction?.route, "/records");
  assert.equal(dogIdAction?.urgency, "watch");
  assert.equal(dogIdAction?.draft?.kind, "pet_credential_prep");
  assert.match(dogIdAction?.detail ?? "", /Dog ID needs/i);
  assert.match(dogIdAction?.draft?.body ?? "", /Phoenix Dog ID Prep/);
  assert.match(dogIdAction?.draft?.body ?? "", /Missing fields:/);
  assert.match(dogIdAction?.draft?.body ?? "", /provider-backed credential\/PDF storage is approved/i);
  assert.match(dogIdAction?.draft?.safety ?? "", /Owner-reviewed prep only/i);
});

test("surfaces saved Dog ID credential history without claiming provider storage", () => {
  const artifact = createPetCredentialArtifact(
    {
      name: "Phoenix",
      generatedAt: "2026-06-08T06:30:00.000Z",
      message: "Phoenix Dog ID\nPrimary vet: River City Vet",
    },
    "2026-06-08T06:30:00.000Z",
  );
  const actions = deriveWoofGuideActions(
    {
      profile: {
        name: "Phoenix",
        breed: "Shepherd mix",
        primaryVet: "River City Vet",
        emergencyContact: "Apollo - 555-0100",
        microchipNumber: "985112003004551",
        insuranceProvider: "Lemonade",
        insurancePolicy: "WW-1042",
      },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      caregivers: [{ name: "Apollo", role: "Owner" }],
      routines: [{ id: "walk", type: "walk", label: "Walk", time: "8:00 AM" }],
      records: [{ id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028" }],
      reportArtifacts: [artifact],
      entries: [
        {
          id: "breakfast",
          type: "meal",
          title: "Breakfast",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T14:00:00.000Z",
          details: { householdVisible: true },
        },
      ],
    },
    NOW,
  );

  const historyAction = actions.find((action) => action.id === "dog-id-history");

  assert.equal(historyAction?.route, "/records");
  assert.equal(historyAction?.urgency, "normal");
  assert.equal(historyAction?.draft?.kind, "pet_credential_history");
  assert.match(historyAction?.detail ?? "", /local Dog ID credential/i);
  assert.match(historyAction?.draft?.body ?? "", /Report History/);
  assert.match(historyAction?.draft?.body ?? "", /local credential sources/i);
  assert.doesNotMatch(historyAction?.draft?.body ?? "", /cloud storage ready|PDF export ready/i);
});

test("surfaces saved report history without claiming native or server-backed export", () => {
  const carePass = createCarePassArtifact(
    buildCarePass({
      audience: "sitter",
      profile: { name: "Phoenix" },
      routines: [{ id: "walk", type: "walk", label: "Morning walk", time: "8:00 AM" }],
      entries: [
        {
          id: "walk-log",
          type: "walk",
          title: "Morning walk",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T14:00:00.000Z",
          details: { householdVisible: true },
        },
      ],
      records: [{ id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028" }],
    }),
    "2026-06-08T06:30:00.000Z",
  );
  const progressReport = createProgressReportArtifact({
    dogName: "Phoenix",
    periodDays: 30,
    generatedAt: "Jun 9, 7:30 AM",
    createdAt: "2026-06-09T06:30:00.000Z",
    summary: "30-day progress report for caregiver and vet review.",
    sections: [{ title: "Care Summary", lines: ["Total entries logged: 14"] }],
  });

  const actions = deriveWoofGuideActions(
    {
      profile: {
        name: "Phoenix",
        breed: "Shepherd mix",
        primaryVet: "River City Vet",
        emergencyContact: "Apollo - 555-0100",
        microchipNumber: "985112003004551",
        insuranceProvider: "Lemonade",
        insurancePolicy: "WW-1042",
      },
      dietProfile: {
        primaryFood: "Sensitive kibble",
        normalPortion: "1 cup",
        mealSchedule: "7 AM and 6 PM",
      },
      caregivers: [{ name: "Apollo", role: "Owner" }],
      routines: [{ id: "walk", type: "walk", label: "Walk", time: "8:00 AM" }],
      records: [{ id: "rabies", type: "vaccine", title: "Rabies", due: "May 20, 2028" }],
      reportArtifacts: [carePass, progressReport],
      entries: [
        {
          id: "breakfast",
          type: "meal",
          title: "Breakfast",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T14:00:00.000Z",
          details: { householdVisible: true },
        },
      ],
    },
    NOW,
  );

  const reportAction = actions.find((action) => action.id === "report-history");

  assert.equal(reportAction?.route, "/records");
  assert.equal(reportAction?.urgency, "normal");
  assert.equal(reportAction?.draft?.kind, "report_history");
  assert.match(reportAction?.detail ?? "", /2 local report sources saved/);
  assert.match(reportAction?.draft?.body ?? "", /Phoenix Report History Review/);
  assert.match(reportAction?.draft?.body ?? "", /Care Pass/);
  assert.match(reportAction?.draft?.body ?? "", /Progress Report/);
  assert.match(reportAction?.draft?.body ?? "", /Resend or share printable source/);
  assert.match(reportAction?.draft?.body ?? "", /Review the latest local source/);
  assert.match(reportAction?.draft?.body ?? "", /routines, medications, records, and audience/);
  assert.match(reportAction?.draft?.body ?? "", /Remove obsolete local sources only after review/);
  assert.match(reportAction?.draft?.body ?? "", /does not revoke shares/);
  assert.match(reportAction?.draft?.safety ?? "", /server-backed report storage/);
  assert.doesNotMatch(reportAction?.draft?.body ?? "", /cloud storage ready|PDF export ready/i);
});
