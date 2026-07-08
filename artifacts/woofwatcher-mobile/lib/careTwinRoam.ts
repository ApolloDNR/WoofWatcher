import type { AvatarRoomZone } from "./avatarLifeEngine.ts";

/**
 * Roam choreography for the immersive Home room: deterministic waypoint
 * walks across the floor band so the care twin physically travels through
 * her room instead of idling on one spot. Pure math so the walk schedule
 * stays testable — the component layer only interpolates and renders.
 */

export interface RoamWaypoint {
  zone: AvatarRoomZone;
  /** Left edge of the sprite rig as a percent of stage width. */
  xPct: number;
  /** Top edge of the sprite rig as a percent of stage height. */
  yPct: number;
  /** Depth cue: sprites closer to the camera render slightly larger. */
  scale: number;
}

export type RoamFacing = "left" | "right";

export interface RoamLeg {
  kind: "dwell" | "walk";
  from: RoamWaypoint;
  to: RoamWaypoint;
  durationMs: number;
  facing: RoamFacing;
}

export interface RoamPlan {
  anchor: RoamWaypoint;
  legs: RoamLeg[];
  totalMs: number;
}

export interface RoamPose {
  xPct: number;
  yPct: number;
  scale: number;
  facing: RoamFacing;
  moving: boolean;
  legIndex: number;
}

export interface RoamPlanInput {
  anchorZone: AvatarRoomZone;
  seed: number;
  /** Pause on each waypoint before the next walk leg. */
  dwellMs?: number;
}

/** Sprite rig travel speed in stage-width percent per second. */
const WALK_SPEED_PCT_PER_SECOND = 10;
const MIN_WALK_MS = 1200;
const MAX_WALK_MS = 6000;
const DEFAULT_DWELL_MS = 3600;

/**
 * Floor-band positions tuned to the immersive backdrops: the rig is 184px
 * wide on a 390pt stage (~47% of the width), so xPct stays within 2-51 to
 * keep paws inside the room. yPct hugs the floor line with a small depth
 * wobble that the scale cue mirrors.
 */
export const IMMERSIVE_ROAM_WAYPOINTS: Record<AvatarRoomZone, RoamWaypoint> = {
  door: { zone: "door", xPct: 3, yPct: 26, scale: 0.99 },
  window: { zone: "window", xPct: 12, yPct: 25, scale: 0.97 },
  rug: { zone: "rug", xPct: 27, yPct: 27, scale: 1 },
  bed: { zone: "bed", xPct: 39, yPct: 26, scale: 1 },
  bowl: { zone: "bowl", xPct: 48, yPct: 28, scale: 1.03 },
};

const ROAM_STOP_ORDER: readonly AvatarRoomZone[] = [
  "door",
  "window",
  "rug",
  "bed",
  "bowl",
];

/** Deterministic PRNG so a seeded roam plan is reproducible in tests. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function facingForTravel(from: RoamWaypoint, to: RoamWaypoint): RoamFacing {
  return to.xPct >= from.xPct ? "right" : "left";
}

function walkDurationMs(from: RoamWaypoint, to: RoamWaypoint): number {
  const distancePct = Math.abs(to.xPct - from.xPct);
  const rawMs = (distancePct / WALK_SPEED_PCT_PER_SECOND) * 1000;
  return Math.round(Math.min(MAX_WALK_MS, Math.max(MIN_WALK_MS, rawMs)));
}

export function deriveCareTwinRoamPlan(input: RoamPlanInput): RoamPlan {
  const anchor =
    IMMERSIVE_ROAM_WAYPOINTS[input.anchorZone] ?? IMMERSIVE_ROAM_WAYPOINTS.rug;
  const dwellMs = Math.max(600, Math.round(input.dwellMs ?? DEFAULT_DWELL_MS));
  const random = mulberry32(Math.floor(input.seed));

  const candidates = ROAM_STOP_ORDER.filter((zone) => zone !== anchor.zone).map(
    (zone) => IMMERSIVE_ROAM_WAYPOINTS[zone],
  );
  // Fisher-Yates with the seeded PRNG keeps stop order stable per seed.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const stopCount = random() < 0.5 ? 2 : 3;
  const stops = candidates.slice(0, stopCount);

  const legs: RoamLeg[] = [];
  let facing: RoamFacing = "left";
  let current = anchor;

  const pushDwell = (at: RoamWaypoint) => {
    legs.push({ kind: "dwell", from: at, to: at, durationMs: dwellMs, facing });
  };
  const pushWalk = (to: RoamWaypoint) => {
    facing = facingForTravel(current, to);
    legs.push({
      kind: "walk",
      from: current,
      to,
      durationMs: walkDurationMs(current, to),
      facing,
    });
    current = to;
  };

  pushDwell(anchor);
  for (const stop of stops) {
    pushWalk(stop);
    pushDwell(stop);
  }
  pushWalk(anchor);

  return {
    anchor,
    legs,
    totalMs: legs.reduce((sum, leg) => sum + leg.durationMs, 0),
  };
}

export function roamPoseAt(plan: RoamPlan, elapsedMs: number): RoamPose {
  const total = Math.max(1, plan.totalMs);
  let remaining =
    ((Math.max(0, elapsedMs) % total) + total) % total;

  for (let index = 0; index < plan.legs.length; index += 1) {
    const leg = plan.legs[index];
    if (remaining >= leg.durationMs) {
      remaining -= leg.durationMs;
      continue;
    }
    const progress = leg.durationMs <= 0 ? 1 : remaining / leg.durationMs;
    const lerp = (a: number, b: number) => a + (b - a) * progress;
    return {
      xPct: leg.kind === "walk" ? lerp(leg.from.xPct, leg.to.xPct) : leg.from.xPct,
      yPct: leg.kind === "walk" ? lerp(leg.from.yPct, leg.to.yPct) : leg.from.yPct,
      scale:
        leg.kind === "walk" ? lerp(leg.from.scale, leg.to.scale) : leg.from.scale,
      facing: leg.facing,
      moving: leg.kind === "walk",
      legIndex: index,
    };
  }

  const lastIndex = plan.legs.length - 1;
  const last = plan.legs[lastIndex];
  return {
    xPct: last.to.xPct,
    yPct: last.to.yPct,
    scale: last.to.scale,
    facing: last.facing,
    moving: false,
    legIndex: lastIndex,
  };
}
