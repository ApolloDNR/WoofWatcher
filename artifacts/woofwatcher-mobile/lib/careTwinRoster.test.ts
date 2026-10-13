import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCareTwinRosterDraft,
  deriveCareTwinRoster,
  removeFutureCareTwinRosterDraft,
  validateFutureCareTwinRosterName,
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
  assert.match(roster.nextStep, /Multi-dog care is coming soon - planned pets stay as slots on this device/);
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

test("rejects blank and duplicate planned-dog names before they can become hidden roster rows", () => {
  const roster = deriveCareTwinRoster({
    profile: { name: "Phoenix", publicLabel: "Phoenix" },
    pets: [{ id: "london", name: "London", status: "provider-gated" }],
  });

  assert.deepEqual(validateFutureCareTwinRosterName("   ", roster), {
    valid: false,
    message: "Add a name for the planned dog.",
  });
  assert.deepEqual(validateFutureCareTwinRosterName(" phoenix ", roster), {
    valid: false,
    message: "Phoenix is already the live care twin.",
  });
  assert.deepEqual(validateFutureCareTwinRosterName("LONDON", roster), {
    valid: false,
    message: "London is already saved as a planned dog.",
  });
  assert.deepEqual(validateFutureCareTwinRosterName("  maple  ", roster), {
    valid: true,
    name: "Maple",
  });
});

test("removes only the selected planned slot and preserves the remaining local roster", () => {
  const pets = [
    buildCareTwinRosterDraft({ name: "London", nowIso: "2026-06-19T20:00:00.000Z" }),
    buildCareTwinRosterDraft({ name: "Maple", nowIso: "2026-06-19T20:01:00.000Z" }),
  ];

  assert.deepEqual(
    removeFutureCareTwinRosterDraft(pets, pets[0].id).map((pet) => pet.name),
    ["Maple"],
  );
  assert.deepEqual(removeFutureCareTwinRosterDraft(pets, "unknown"), pets);
});

test("never removes a non-planned roster row", () => {
  const pets = [
    { id: "planned", name: "London", status: "provider-gated" as const },
    { id: "setup", name: "Maple", status: "setup-needed" as const },
    { id: "live", name: "Nova", status: "live" as const },
  ];

  assert.deepEqual(
    removeFutureCareTwinRosterDraft(pets, "planned").map((pet) => pet.id),
    ["setup", "live"],
  );
  assert.deepEqual(removeFutureCareTwinRosterDraft(pets, "setup"), pets);
  assert.deepEqual(removeFutureCareTwinRosterDraft(pets, "live"), pets);
});

test("removes at most one planned slot when corrupted roster ids collide", () => {
  const pets = [
    { id: "duplicate", name: "London", status: "provider-gated" as const },
    { id: "duplicate", name: "Maple", status: "provider-gated" as const },
    { id: "live", name: "Phoenix", status: "live" as const },
  ];

  assert.deepEqual(
    removeFutureCareTwinRosterDraft(pets, "duplicate").map((pet) => pet.name),
    ["Maple", "Phoenix"],
  );
});
