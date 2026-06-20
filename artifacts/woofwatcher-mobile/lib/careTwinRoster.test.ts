import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCareTwinRosterDraft,
  deriveCareTwinRoster,
} from "./careTwinRoster.ts";

test("derives the primary dog as the only live care twin by default", () => {
  const roster = deriveCareTwinRoster({
    profile: {
      name: "Phoenix",
      publicLabel: "Phoenix",
      breed: "German Shepherd mix",
      weight: { current: 68, unit: "lb" },
    },
    pets: [],
  });

  assert.equal(roster.activePet.id, "primary");
  assert.equal(roster.activePet.name, "Phoenix");
  assert.equal(roster.liveCount, 1);
  assert.equal(roster.futureCount, 0);
  assert.match(roster.summary, /Phoenix is the live care twin/);
  assert.match(roster.nextStep, /Add future pets only as planned slots/);
});

test("keeps future pet slots provider-gated so logs do not mix across dogs", () => {
  const roster = deriveCareTwinRoster({
    activePetId: "london",
    profile: {
      name: "Phoenix",
      publicLabel: "Phoenix",
      breed: "German Shepherd mix",
      weight: { current: 68, unit: "lb" },
    },
    pets: [
      {
        id: "london",
        name: "London",
        breed: "Golden Retriever",
        weight: { current: 55, unit: "lb" },
        status: "provider-gated",
      },
    ],
  });

  assert.equal(roster.activePet.id, "primary");
  assert.equal(roster.pets[1].name, "London");
  assert.equal(roster.pets[1].status, "provider-gated");
  assert.equal(roster.pets[1].isActive, false);
  assert.equal(roster.pets[1].canSwitch, false);
  assert.equal(roster.futureCount, 1);
  assert.match(roster.nextStep, /provider-backed multi-dog care documents/);
});

test("builds a sanitized planned pet draft for the local roster", () => {
  const draft = buildCareTwinRosterDraft({
    name: "  London   ",
    breed: " Golden Retriever ",
    nowIso: "2026-06-19T20:00:00.000Z",
  });

  assert.equal(draft.id, "pet_london_1781899200000");
  assert.equal(draft.name, "London");
  assert.equal(draft.breed, "Golden Retriever");
  assert.equal(draft.status, "provider-gated");
  assert.equal(draft.createdAt, "2026-06-19T20:00:00.000Z");
});
