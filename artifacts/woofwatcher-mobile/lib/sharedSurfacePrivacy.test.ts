import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CareState } from "../context/CareContext";
import { buildWoofGuideAssistantContext } from "./woofGuideAssistantContext.ts";
import {
  deriveWoofGuideActions,
  deriveWoofGuideVetNoteAction,
} from "./woofGuideActions.ts";

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("shared Trends charts cannot count private, future, or malformed care evidence", () => {
  const source = read("components/health/TrendsScreen.tsx");
  const chartEvidence = source.slice(
    source.indexOf("const { moodSamples, activitySamples, pottyTimes }"),
    source.indexOf("const moodAverages"),
  );

  assert.match(
    chartEvidence,
    /const sharedEntries = selectSharedCareEvidence\(state\.entries, now\)/,
  );
  assert.match(chartEvidence, /deriveMoodTrend\(\{\s*entries: sharedEntries,/);
  assert.match(chartEvidence, /for \(const entry of sharedEntries\)/);
  assert.doesNotMatch(chartEvidence, /entries: state\.entries/);
  assert.doesNotMatch(chartEvidence, /for \(const entry of state\.entries\)/);
});

test("Care Team caregiver totals count only shared observable logs", () => {
  const source = read("components/more/CareTeamSuppliesScreen.tsx");
  assert.match(
    source,
    /const sharedEntries = selectSharedCareEvidence\(state\.entries, now\)/,
  );
  assert.match(source, /const logCount = sharedEntries\.filter\(/);
  assert.doesNotMatch(source, /const logCount = state\.entries\.filter\(/);
});

test("the shared Care Twin never reacts to a private or future care entry", () => {
  const source = read("components/more/AvatarStudioScreen.tsx");
  const motion = source.slice(
    source.indexOf("const avatarSummary"),
    source.indexOf("const caregiver ="),
  );

  assert.match(
    motion,
    /const sharedEntries = useMemo\([\s\S]*selectSharedCareEvidence\(state\.entries, now\)/,
  );
  assert.match(motion, /deriveAvatarMotion\(\{\s*entries: sharedEntries,/);
  assert.doesNotMatch(motion, /entries: state\.entries/);
});

test("WoofGuide routes every summary and draft through privacy-enforcing boundaries", () => {
  const source = read("components/more/WoofGuideScreen.tsx");

  assert.match(source, /buildWoofGuideAssistantContext\(state\)/);
  assert.match(source, /deriveWoofGuideActions\(state\)/);
  assert.match(source, /deriveWoofGuideVetNoteAction\(state\)/);
  assert.doesNotMatch(source, /function buildAssistantContext/);
});

test("WoofGuide behavior ignores private, future, and malformed care evidence", () => {
  const now = Date.parse("2026-06-06T22:00:00.000Z");
  const state = {
    profile: {
      name: "Phoenix",
      breed: "Mixed",
      background: "Rescue",
      careFocus: "Calm meals",
      weight: { current: 42, goal: "Maintain", unit: "lb" },
      vetBoundary: "Not a diagnosis",
    },
    caregivers: [],
    dietProfile: {
      primaryFood: "Sensitive kibble",
      normalPortion: "1 cup",
      mealSchedule: "7 AM and 6 PM",
    },
    routines: [{ id: "meal", type: "meal", label: "Dinner", time: "6:00 PM" }],
    records: [
      { id: "rabies", type: "vaccine", title: "Rabies", due: "2028-05-20" },
      {
        id: "chip",
        type: "microchip",
        title: "HomeAgain",
        due: "985112003004551",
      },
      { id: "insurance", type: "insurance", title: "Lemonade", due: "WW-1042" },
    ],
    entries: [
      {
        id: "private-vomit",
        type: "vomit",
        title: "Private incident",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T21:00:00.000Z",
        severity: "watch",
        details: { householdVisible: false, kind: "yellow bile" },
      },
      {
        id: "private-meal",
        type: "meal",
        title: "Private meal",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T20:00:00.000Z",
        details: { householdVisible: false },
      },
      {
        id: "future-shared",
        type: "vomit",
        title: "Future incident",
        caregiver: "Apollo",
        occurredAt: "2026-06-07T21:00:00.000Z",
        severity: "urgent",
        details: { householdVisible: true },
      },
      {
        id: "malformed-shared",
        type: "vomit",
        title: "Malformed incident",
        caregiver: "Apollo",
        occurredAt: "not-a-date",
        severity: "urgent",
        details: { householdVisible: true },
      },
      ...["true", "false", null, 0, 1, {}, []].map(
        (householdVisible, index) => ({
          id: `malformed-visibility-${index}`,
          type: "vomit",
          title: "Malformed visibility incident",
          caregiver: "Apollo",
          occurredAt: "2026-06-06T19:00:00.000Z",
          severity: "urgent",
          details: { householdVisible, kind: "must stay private" },
        }),
      ),
    ],
  } as unknown as CareState;

  const actions = deriveWoofGuideActions(state, now);
  const vetDraft = deriveWoofGuideVetNoteAction(state, now);
  const payload = buildWoofGuideAssistantContext(state, now);

  assert.equal(
    actions.some((action) => action.id === "vet-note"),
    false,
  );
  assert.equal(
    actions.some((action) => action.id === "log-meal"),
    true,
  );
  assert.equal(vetDraft.urgency, "normal");
  assert.deepEqual(vetDraft.draft?.sourceEntryIds, []);
  assert.equal(payload.summary.totalEntries, 0);
  assert.equal(payload.summary.todayEntries, 0);
  assert.equal(payload.summary.meals, 0);
  assert.equal(payload.summary.vomitIncidents, 0);
  assert.deepEqual(payload.handoff.followUps, []);
  assert.deepEqual(payload.latest, []);
});
