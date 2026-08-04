import assert from "node:assert/strict";
import test from "node:test";

import {
  IMMERSIVE_ROAM_WAYPOINTS,
  careTwinCanRoam,
  deriveCareTwinRoamPlan,
  resolveRoamingTwinSpriteAction,
  roamPoseAt,
} from "./careTwinRoam.ts";

test("an active walk keeps the twin roaming even though walking is a care-action scene", () => {
  assert.equal(
    careTwinCanRoam({
      transparentScene: true,
      isStudio: false,
      scenePhase: "care-action",
      awayOnWalk: true,
      hasWalkSprite: true,
      hasDwellSprite: true,
    }),
    true,
  );
  assert.equal(
    careTwinCanRoam({
      transparentScene: true,
      isStudio: false,
      scenePhase: "care-action",
      awayOnWalk: false,
      hasWalkSprite: true,
      hasDwellSprite: true,
    }),
    false,
  );
});

test("the roaming rig paints the current gait immediately instead of trailing through an invisible pose", () => {
  assert.equal(
    resolveRoamingTwinSpriteAction({
      moving: true,
      dwellAction: "tail-wag",
      overrideAction: null,
    }),
    "walk-loop",
  );
  assert.equal(
    resolveRoamingTwinSpriteAction({
      moving: false,
      dwellAction: "tail-wag",
      overrideAction: "ear-perk",
    }),
    "ear-perk",
  );
});

test("roam plan is deterministic per seed and varies across seeds", () => {
  const a = deriveCareTwinRoamPlan({ anchorZone: "rug", seed: 7 });
  const b = deriveCareTwinRoamPlan({ anchorZone: "rug", seed: 7 });
  assert.deepEqual(a, b, "same seed should reproduce the same plan");

  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const signatures = new Set(
    seeds.map((seed) =>
      deriveCareTwinRoamPlan({ anchorZone: "rug", seed })
        .legs.map((leg) => `${leg.kind}:${leg.to.zone}`)
        .join("|"),
    ),
  );
  assert.ok(
    signatures.size > 1,
    "different seeds should produce different stop orders",
  );
});

test("roam plan starts and ends at the anchor with alternating dwell/walk", () => {
  const plan = deriveCareTwinRoamPlan({ anchorZone: "door", seed: 21 });

  assert.equal(plan.anchor.zone, "door");
  assert.equal(plan.legs[0].kind, "dwell");
  assert.equal(plan.legs[0].from.zone, "door");
  const last = plan.legs[plan.legs.length - 1];
  assert.equal(last.kind, "walk");
  assert.equal(last.to.zone, "door", "the loop should walk home to its anchor");

  for (let i = 0; i < plan.legs.length; i += 1) {
    assert.equal(
      plan.legs[i].kind,
      i % 2 === 0 ? "dwell" : "walk",
      `leg ${i} should alternate dwell/walk`,
    );
    if (i > 0) {
      assert.equal(
        plan.legs[i].from.zone,
        plan.legs[i - 1].to.zone,
        `leg ${i} should start where leg ${i - 1} ended`,
      );
    }
  }

  assert.equal(
    plan.totalMs,
    plan.legs.reduce((sum, leg) => sum + leg.durationMs, 0),
    "totalMs must be the true sum of leg durations",
  );
});

test("walk legs face the direction of travel", () => {
  for (const seed of [3, 11, 42, 99]) {
    const plan = deriveCareTwinRoamPlan({ anchorZone: "bowl", seed });
    for (const leg of plan.legs) {
      if (leg.kind !== "walk") continue;
      assert.equal(
        leg.facing,
        leg.to.xPct >= leg.from.xPct ? "right" : "left",
        "walk facing must match horizontal travel",
      );
    }
  }
});

test("roam pose interpolates walks, holds dwells, and wraps the loop", () => {
  const plan = deriveCareTwinRoamPlan({
    anchorZone: "rug",
    seed: 5,
    dwellMs: 2000,
  });

  const atStart = roamPoseAt(plan, 0);
  assert.equal(atStart.moving, false, "the loop opens with a dwell");
  assert.equal(atStart.xPct, plan.anchor.xPct);

  const firstWalk = plan.legs[1];
  const midWalk = roamPoseAt(plan, plan.legs[0].durationMs + firstWalk.durationMs / 2);
  assert.equal(midWalk.moving, true);
  const lower = Math.min(firstWalk.from.xPct, firstWalk.to.xPct);
  const upper = Math.max(firstWalk.from.xPct, firstWalk.to.xPct);
  assert.ok(
    midWalk.xPct > lower && midWalk.xPct < upper,
    "mid-walk pose should sit strictly between the endpoints",
  );

  const wrapped = roamPoseAt(plan, plan.totalMs + 1);
  assert.equal(wrapped.legIndex, 0, "elapsed time should wrap around the loop");
  assert.equal(wrapped.moving, false);
});

test("waypoints keep the sprite rig inside the immersive stage", () => {
  for (const waypoint of Object.values(IMMERSIVE_ROAM_WAYPOINTS)) {
    assert.ok(
      waypoint.xPct >= 2 && waypoint.xPct <= 51,
      `${waypoint.zone} xPct ${waypoint.xPct} must keep the 184px rig on a 390pt stage`,
    );
    assert.ok(
      waypoint.yPct >= 22 && waypoint.yPct <= 32,
      `${waypoint.zone} yPct ${waypoint.yPct} must keep paws on the framed card's floor band`,
    );
    assert.ok(
      waypoint.scale >= 0.94 && waypoint.scale <= 1.08,
      `${waypoint.zone} scale ${waypoint.scale} must stay a subtle depth cue`,
    );
  }
});
