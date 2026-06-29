import { test } from "node:test";
import assert from "node:assert/strict";

import { buildHomeMissionDeck } from "./homeMissionDeck.ts";

test("builds a care-RPG mission deck from real open care state", () => {
  const missions = buildHomeMissionDeck({
    petName: "Phoenix",
    caregiverName: "Emma",
    nextCare: {
      label: "Dinner served",
      detail: "Outcome pending - update when Phoenix finishes",
      icon: "meal",
      route: "/log?type=meal",
      openLoop: true,
    },
    adventure: {
      title: "Wildflower Trail",
      level: 12,
      todayXp: 50,
      memoriesCount: 18,
    },
    health: {
      label: "Bile Watch",
      status: "Watch",
      detail: "1 flagged today",
      needsReview: true,
    },
    carePass: {
      label: "Vet Care Pass",
      detail: "Records and health summary ready to review",
      ready: true,
    },
  });

  assert.deepEqual(
    missions.map((mission) => mission.key),
    ["care-today", "adventure", "health", "care-pass"],
  );

  assert.equal(missions[0].route, "/log?type=meal");
  assert.equal(missions[0].statusLabel, "Open loop");
  assert.equal(missions[0].tone, "copper");
  assert.match(missions[0].detail, /Outcome pending/);

  assert.equal(missions[1].route, "/adventure");
  assert.equal(missions[1].cta, "Start quest");
  assert.match(missions[1].detail, /Level 12/);
  assert.match(missions[1].detail, /18 memories/);

  assert.equal(missions[2].route, "/health?tab=bile");
  assert.equal(missions[2].tone, "amber");
  assert.equal(missions[2].cta, "Review");

  assert.equal(missions[3].route, "/records");
  assert.equal(missions[3].cta, "Open pass");
});

test("keeps mission copy useful when the day has no urgent open loop", () => {
  const missions = buildHomeMissionDeck({
    petName: "Phoenix",
    caregiverName: "Apollo",
    nextCare: {
      label: "Walk with Apollo",
      detail: "In 45m - 5:30 PM",
      icon: "walk",
      route: "/calendar",
      openLoop: false,
    },
    adventure: {
      title: "Forest Sniffari",
      level: 3,
      todayXp: 0,
      memoriesCount: 2,
    },
    health: {
      label: "Health Watch",
      status: "Stable",
      detail: "All good right now",
      needsReview: false,
    },
    carePass: {
      label: "Sitter Care Pass",
      detail: "Routine, diet, and emergency notes",
      ready: false,
    },
  });

  assert.equal(missions[0].route, "/calendar");
  assert.equal(missions[0].statusLabel, "Next care");
  assert.equal(missions[0].tone, "sage");
  assert.equal(missions[0].cta, "View plan");
  assert.match(missions[0].title, /Walk with Apollo/);

  assert.equal(missions[2].tone, "sage");
  assert.equal(missions[2].route, "/health?tab=health");
  assert.equal(missions[2].statusLabel, "Stable");
  assert.equal(missions[3].statusLabel, "Build pass");
});
