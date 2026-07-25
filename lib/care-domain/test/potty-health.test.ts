import { test } from "node:test";
import assert from "node:assert/strict";

import { derivePottyHealth } from "../src/index.ts";

process.env.TZ = "America/Los_Angeles";

const NOW = new Date("2026-06-06T20:00:00-07:00").getTime();

test("derives daily potty health from visible stool and pee logs", () => {
  const potty = derivePottyHealth({
    now: NOW,
    entries: [
      {
        id: "old",
        type: "potty",
        title: "Yesterday potty",
        caregiver: "Apollo",
        occurredAt: "2026-06-05T12:00:00-07:00",
        details: { kind: "poop", condition: "normal" },
      },
      {
        id: "private",
        type: "potty",
        title: "Private potty",
        caregiver: "Emma",
        occurredAt: "2026-06-06T09:15:00-07:00",
        details: { kind: "pee", condition: "normal", householdVisible: false },
      },
      {
        id: "morning",
        type: "potty",
        title: "Potty - pee",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:10:00-07:00",
        details: { kind: "pee", condition: "normal" },
      },
      {
        id: "midday",
        type: "potty",
        title: "Potty - pee & poop",
        caregiver: "Emma",
        occurredAt: "2026-06-06T12:30:00-07:00",
        details: { kind: "both", condition: "soft", note: "Soft but no blood." },
      },
      {
        id: "evening",
        type: "poop",
        title: "Poop off",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T18:20:00-07:00",
        severity: "alert",
        details: { condition: "diarrhea", stoolColor: "yellow" },
      },
    ],
  });

  assert.equal(potty.total, 3);
  assert.equal(potty.peeCount, 2);
  assert.equal(potty.poopCount, 2);
  assert.equal(potty.watchCount, 2);
  assert.equal(potty.status, "watch");
  assert.equal(potty.summary, "3 potty logs today - 2 pee, 2 poop, 2 need stool review");
  assert.deepEqual(potty.conditions, ["diarrhea", "soft"]);
  assert.deepEqual(potty.caregivers, ["Apollo", "Emma"]);
  assert.equal(potty.last?.id, "evening");
  assert.equal(potty.last?.condition, "diarrhea");
  assert.equal(potty.last?.stoolColor, "yellow");
  assert.match(potty.nextStep, /stool detail/i);
});

test("uses a steady message when potty logs are normal", () => {
  const potty = derivePottyHealth({
    now: NOW,
    entries: [
      {
        id: "pee",
        type: "potty",
        title: "Potty - pee",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:10:00-07:00",
        details: { kind: "pee", condition: "normal" },
      },
      {
        id: "poop",
        type: "potty",
        title: "Potty - poop",
        caregiver: "Emma",
        occurredAt: "2026-06-06T12:30:00-07:00",
        details: { kind: "poop", condition: "normal" },
      },
    ],
  });

  assert.equal(potty.status, "steady");
  assert.equal(potty.watchCount, 0);
  assert.equal(potty.summary, "2 potty logs today - 1 pee, 1 poop, stool normal");
  assert.match(potty.nextStep, /Keep logging/i);
});

test("watch nextStep uses the renamed dog's name, never Phoenix", () => {
  const potty = derivePottyHealth({
    now: NOW,
    petName: "Biscuit",
    entries: [
      {
        id: "watch-poop",
        type: "potty",
        title: "Potty - poop",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T09:00:00-07:00",
        details: { kind: "poop", condition: "diarrhea" },
      },
    ],
  });

  assert.equal(potty.status, "watch");
  assert.match(potty.nextStep, /Biscuit seems painful/);
  assert.doesNotMatch(potty.nextStep, /Phoenix/);
});

test("uses stool color and context as review evidence", () => {
  const potty = derivePottyHealth({
    now: NOW,
    entries: [
      {
        id: "brown",
        type: "potty",
        title: "Potty - poop",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T07:20:00-07:00",
        details: { kind: "poop", condition: "normal", stoolColor: "brown", pottyContext: "routine" },
      },
      {
        id: "red",
        type: "potty",
        title: "Potty - poop",
        caregiver: "Apollo",
        occurredAt: "2026-06-06T08:10:00-07:00",
        details: { kind: "poop", condition: "normal", stoolColor: "red-black", pottyContext: "straining" },
      },
      {
        id: "yellow",
        type: "potty",
        title: "Potty - pee & poop",
        caregiver: "Emma",
        occurredAt: "2026-06-06T12:30:00-07:00",
        details: { kind: "both", condition: "normal", stoolColor: "yellow", pottyContext: "accident" },
      },
    ],
  });

  assert.equal(potty.total, 3);
  assert.equal(potty.peeCount, 1);
  assert.equal(potty.poopCount, 3);
  assert.equal(potty.watchCount, 2);
  assert.equal(potty.summary, "3 potty logs today - 1 pee, 3 poop, 2 need stool review");
  assert.deepEqual(potty.stoolColors, ["yellow", "red-black", "brown"]);
  assert.deepEqual(potty.contexts, ["accident", "straining", "routine"]);
  assert.equal(potty.last?.stoolColor, "yellow");
  assert.equal(potty.last?.context, "accident");
});
