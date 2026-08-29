import assert from "node:assert/strict";
import test from "node:test";

import type { CareState } from "../context/CareContext";
import { buildWoofGuideAssistantContext } from "./woofGuideAssistantContext.ts";

const NOW = Date.parse("2026-08-29T12:00:00.000Z");

function state(entries: CareState["entries"] = []): CareState {
  return {
    profile: {
      name: "Luna",
      breed: "Mixed breed",
      background: "",
      careFocus: "",
      weight: { current: 42, goal: "Maintain", unit: "lb" },
      vetBoundary: "Not veterinary advice.",
    },
    caregivers: [],
    dietProfile: {
      primaryFood: "",
      normalPortion: "",
      mealSchedule: "",
    },
    routines: [],
    records: [],
    entries,
  } as unknown as CareState;
}

test("includes canonical alert entries in WoofGuide follow-ups", () => {
  const context = buildWoofGuideAssistantContext(
    state([
      {
        id: "urgent-potty",
        type: "potty",
        title: "Urgent potty",
        caregiver: "Jordan",
        occurredAt: "2026-08-29T11:30:00.000Z",
        severity: "alert",
        details: { pottyContext: "urgent", householdVisible: true },
      },
      {
        id: "watch-meal",
        type: "meal",
        title: "Partial meal",
        caregiver: "Jordan",
        occurredAt: "2026-08-29T10:30:00.000Z",
        severity: "watch",
        details: { householdVisible: true },
      },
    ]),
    NOW,
  );

  assert.deepEqual(
    context.handoff.followUps.map((entry) => entry.id),
    ["urgent-potty", "watch-meal"],
  );
});

test("describes a good Health Watch state as no logged signals, not no concerns", () => {
  const context = buildWoofGuideAssistantContext(state(), NOW);

  assert.equal(context.healthWatch.status, "good");
  assert.equal(context.healthWatch.label, "No logged Health Watch signals");
});
