import { test } from "node:test";
import assert from "node:assert/strict";

import { describeCareTwinReactionForLog } from "./careTwinReactionPolicy.ts";

test("maps quick care logs to the current care twin instead of generic bubbles", () => {
  assert.deepEqual(
    describeCareTwinReactionForLog({
      type: "meal",
      label: "Meal",
      details: { mealLifecycle: "outcome-pending", mealCompletion: "served" },
    }),
    {
      icon: "meal",
      label: "Meal served",
      detail: "Outcome stays open so the household can update what your dog actually ate.",
      spriteAction: "eat-loop",
      toneRole: "care",
    },
  );

  assert.deepEqual(
    describeCareTwinReactionForLog({
      type: "potty",
      label: "Potty",
      details: { pottyOutcome: "attempt" },
    }),
    {
      icon: "pee",
      label: "Potty noted",
      detail: "Bathroom attempt logged without pretending pee or poop happened.",
      spriteAction: "ear-perk",
      toneRole: "care",
    },
  );

  assert.equal(describeCareTwinReactionForLog({ type: "water", label: "Water" }).spriteAction, "drink-loop");
  assert.equal(describeCareTwinReactionForLog({ type: "walk", label: "Walk" }).spriteAction, "walk-loop");
});

test("keeps health and safety reactions calm and non-diagnostic", () => {
  const vomit = describeCareTwinReactionForLog({
    type: "vomit",
    label: "Vomit",
    severity: "alert",
  });
  const incident = describeCareTwinReactionForLog({
    type: "incident",
    label: "Incident",
    severity: "alert",
  });

  assert.equal(vomit.spriteAction, "health-watch");
  assert.equal(vomit.toneRole, "health");
  assert.match(vomit.detail, /Health Watch/i);
  assert.doesNotMatch(vomit.detail, /diagnos/i);

  assert.equal(incident.spriteAction, "comfort-loop");
  assert.equal(incident.toneRole, "health");
  assert.match(incident.detail, /review/i);
  assert.doesNotMatch(incident.detail, /diagnos/i);
});

test("uses celebration only for real care wins", () => {
  assert.equal(describeCareTwinReactionForLog({ type: "training", label: "Training" }).spriteAction, "celebrate-hop");
  assert.equal(describeCareTwinReactionForLog({ type: "treat", label: "Treat" }).spriteAction, "celebrate-hop");
  assert.equal(describeCareTwinReactionForLog({ type: "play", label: "Play" }).spriteAction, "tail-wag");
});

test("uses the current or neutral household identity in consumer reaction copy", () => {
  const freshInstall = ["meal", "walk", "training", "play", "mood", "note"].map((type) =>
    describeCareTwinReactionForLog({
      type,
      label: "Care",
      petName: "My Dog",
      ...(type === "meal" ? { details: { mealLifecycle: "outcome-pending" } } : {}),
      ...(type === "walk" ? { details: { walkStartedAt: "2026-08-23T12:00:00.000Z" } } : {}),
    }),
  );

  assert.doesNotMatch(JSON.stringify(freshInstall), /Phoenix|My Dog/);
  assert.match(freshInstall[0]?.detail ?? "", /your dog/);
  assert.match(freshInstall[1]?.detail ?? "", /Your dog/);

  assert.match(
    describeCareTwinReactionForLog({ type: "training", label: "Training", petName: "Luna" }).detail,
    /Luna's story/,
  );
  assert.match(
    describeCareTwinReactionForLog({ type: "play", label: "Play", petName: "Gus" }).detail,
    /Gus' care twin/,
  );
});
