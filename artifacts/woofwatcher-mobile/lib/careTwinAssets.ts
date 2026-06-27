import type { ImageSourcePropType } from "react-native";

import {
  CARE_TWIN_SPRITE_MANIFEST,
  deriveCareTwinScene,
  type AvatarLifePlan,
  type CareTwinNeed,
  type CareTwinScenePhase,
  type CareTwinSpriteAction,
  type CareTwinSpriteTrack,
} from "./avatarLifeEngine.ts";
import type { AvatarMotionModel, AvatarMotionState } from "./avatarMotion.ts";
import { getCareTwinStageFraming, type CareTwinStageFraming } from "./careTwinStage.ts";
import type { Mood } from "./phoenixStatus";

export interface CareTwinSpriteAsset {
  source: ImageSourcePropType;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
}

export interface CareTwinRoomLayerAsset {
  source: ImageSourcePropType;
  description: string;
}

export interface CareTwinSpriteSlot {
  action: CareTwinSpriteAction;
  expectedPath: string;
  frameCount: number;
  fps: number;
  loop: boolean;
  anchor: CareTwinSpriteTrack["anchor"];
  slotSize: number;
  assetReady: boolean;
}

export interface CareTwinLayerReadiness {
  layeredReady: boolean;
  spriteReady: boolean;
  roomReady: boolean;
  missing: readonly string[];
}

export interface CareTwinRuntimeQaScenario {
  id: string;
  label: string;
  motion: AvatarMotionModel;
  expectedAction: CareTwinSpriteAction;
  expectedRoomVariant: CareTwinRoomVariantKey;
  expectedZone: AvatarLifePlan["zone"];
  expectedScenePhase: CareTwinScenePhase;
  expectedNeed: CareTwinNeed;
  nativeQaPrompt: string;
}

export interface CareTwinRuntimeQaResult {
  scenario: CareTwinRuntimeQaScenario;
  plan: AvatarLifePlan;
  actualAction: CareTwinSpriteAction;
  actualRoomVariant: CareTwinRoomVariantKey;
  actualZone: AvatarLifePlan["zone"];
  actualScenePhase: CareTwinScenePhase;
  actualNeed: CareTwinNeed;
  stageFraming: CareTwinStageFraming;
  readiness: CareTwinLayerReadiness;
}

function bundledAsset(path: string, source: () => ImageSourcePropType): ImageSourcePropType {
  return typeof require === "function" ? source() : { uri: path };
}

export const CARE_TWIN_SPRITE_ASSETS: Partial<Record<CareTwinSpriteAction, CareTwinSpriteAsset>> = {
  "idle-breathe": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-idle-tail-wag-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-idle-tail-wag-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "tail-wag": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-idle-tail-wag-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-idle-tail-wag-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "ear-perk": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-ear-perk-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-ear-perk-strip.png"),
    ),
    columns: 6,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "walk-loop": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-walk-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-walk-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "eat-loop": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-eat-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-eat-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "drink-loop": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-drink-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-drink-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "sleep-loop": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-sleep-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-sleep-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "comfort-loop": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-comfort-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-comfort-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "celebrate-hop": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-celebrate-hop-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-celebrate-hop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "health-watch": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-health-watch-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-health-watch-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "bark-loop": {
    source: bundledAsset("assets/avatar/phoenix/candidates/option-b-bark-reaction-strip.png", () =>
      require("@/assets/avatar/phoenix/candidates/option-b-bark-reaction-strip.png"),
    ),
    columns: 6,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
};

export const CARE_TWIN_ROOM_VARIANT_ASSETS = {
  day: {
    source: bundledAsset("assets/avatar/rooms/phoenix-room-day-option-b.png", () =>
      require("@/assets/avatar/rooms/phoenix-room-day-option-b.png"),
    ),
    description: "Option B Dogless neo-retro Phoenix day room with empty rug for layered sprite animation.",
  },
  night: {
    source: bundledAsset("assets/avatar/rooms/phoenix-room-night.png", () =>
      require("@/assets/avatar/rooms/phoenix-room-night.png"),
    ),
    description: "Dogless neo-retro Phoenix night room variant for quiet care-twin states.",
  },
  bedtime: {
    source: bundledAsset("assets/avatar/rooms/phoenix-room-bedtime.png", () =>
      require("@/assets/avatar/rooms/phoenix-room-bedtime.png"),
    ),
    description: "Dogless neo-retro Phoenix bedtime room variant for sleep and rest states.",
  },
  healthWatch: {
    source: bundledAsset("assets/avatar/rooms/phoenix-room-health-watch.png", () =>
      require("@/assets/avatar/rooms/phoenix-room-health-watch.png"),
    ),
    description: "Dogless neo-retro Phoenix health-watch room variant with calm low-pressure grading.",
  },
  homeAlone: {
    source: bundledAsset("assets/avatar/rooms/phoenix-room-home-alone.png", () =>
      require("@/assets/avatar/rooms/phoenix-room-home-alone.png"),
    ),
    description: "Dogless neo-retro Phoenix home-alone room variant with softer cool lighting.",
  },
} satisfies Record<string, CareTwinRoomLayerAsset>;

type CareTwinRoomVariantRegistry = typeof CARE_TWIN_ROOM_VARIANT_ASSETS;
export type CareTwinRoomVariantKey = keyof CareTwinRoomVariantRegistry;

const DAY_ROOM: CareTwinRoomLayerAsset = CARE_TWIN_ROOM_VARIANT_ASSETS.day;

const HOME_ALONE_ROOM: CareTwinRoomLayerAsset = CARE_TWIN_ROOM_VARIANT_ASSETS.homeAlone;

const HEALTH_WATCH_ROOM: CareTwinRoomLayerAsset = CARE_TWIN_ROOM_VARIANT_ASSETS.healthWatch;

const BEDTIME_ROOM: CareTwinRoomLayerAsset = CARE_TWIN_ROOM_VARIANT_ASSETS.bedtime;

const NIGHT_ROOM: CareTwinRoomLayerAsset = CARE_TWIN_ROOM_VARIANT_ASSETS.night;

const LEGACY_DAY_ROOM: CareTwinRoomLayerAsset = {
  source: bundledAsset("assets/avatar/rooms/phoenix-room-day.png", () =>
    require("@/assets/avatar/rooms/phoenix-room-day.png"),
  ),
  description: "Dogless neo-retro Phoenix room with empty rug for layered sprite animation.",
};

export const CARE_TWIN_DOGLESS_ROOM_ASSETS: Partial<Record<Mood, CareTwinRoomLayerAsset>> = {
  happy: DAY_ROOM,
  excited: DAY_ROOM,
  calm: DAY_ROOM,
  anxious: HOME_ALONE_ROOM,
  unwell: HEALTH_WATCH_ROOM,
};

const ROOM_VARIANT_BY_MOOD: Partial<Record<Mood, CareTwinRoomVariantKey>> = {
  happy: "day",
  excited: "day",
  calm: "day",
  anxious: "homeAlone",
  unwell: "healthWatch",
};

function qaMotion(
  state: AvatarMotionState,
  avatarMood: Mood,
  cue: AvatarMotionModel["cue"],
  label: string,
): AvatarMotionModel {
  return {
    state,
    avatarMood,
    cue,
    intensity: "medium",
    label,
    speech: label,
    line: label,
    route: "/log",
  };
}

export const CARE_TWIN_RUNTIME_QA_SCENARIOS: readonly CareTwinRuntimeQaScenario[] = [
  {
    id: "steady-happy",
    label: "Steady happy idle",
    motion: qaMotion("happy", "happy", "tail-wag", "Care is steady."),
    expectedAction: "tail-wag",
    expectedRoomVariant: "day",
    expectedZone: "rug",
    expectedScenePhase: "idle",
    expectedNeed: "bond",
    nativeQaPrompt: "Phoenix should idle on the day-room rug with a soft tail wag and no duplicate dog baked into the room.",
  },
  {
    id: "routine-excited",
    label: "Upcoming activity excitement",
    motion: qaMotion("excited", "excited", "paw-bounce", "Walk soon."),
    expectedAction: "celebrate-hop",
    expectedRoomVariant: "day",
    expectedZone: "door",
    expectedScenePhase: "routine",
    expectedNeed: "activity",
    nativeQaPrompt: "Phoenix should feel ready by the door without leaving the stage crop on a phone viewport.",
  },
  {
    id: "activity-needed",
    label: "Bored activity need",
    motion: qaMotion("bored", "excited", "paw-bounce", "Still waiting."),
    expectedAction: "walk-loop",
    expectedRoomVariant: "day",
    expectedZone: "door",
    expectedScenePhase: "routine",
    expectedNeed: "activity",
    nativeQaPrompt: "Walk-cycle motion should read as activity-needed and keep paws anchored inside the day room.",
  },
  {
    id: "meal-due-alert",
    label: "Meal due attention",
    motion: qaMotion("annoyed", "anxious", "ear-perk", "Meal time?"),
    expectedAction: "ear-perk",
    expectedRoomVariant: "night",
    expectedZone: "bowl",
    expectedScenePhase: "routine",
    expectedNeed: "hunger",
    nativeQaPrompt: "Ear-perk attention should use the night room when Phoenix is anxious, with the bowl zone still visually clear.",
  },
  {
    id: "comfort-watch",
    label: "Needs comfort",
    motion: qaMotion("sad", "anxious", "head-tilt", "Stay close?"),
    expectedAction: "comfort-loop",
    expectedRoomVariant: "homeAlone",
    expectedZone: "window",
    expectedScenePhase: "watch",
    expectedNeed: "comfort",
    nativeQaPrompt: "Comfort motion should feel calm and emotionally warm in the home-alone room, not medically alarming.",
  },
  {
    id: "low-energy-rest",
    label: "Low energy rest",
    motion: qaMotion("tired", "calm", "low-energy", "Slow day."),
    expectedAction: "sleep-loop",
    expectedRoomVariant: "bedtime",
    expectedZone: "bed",
    expectedScenePhase: "rest",
    expectedNeed: "rest",
    nativeQaPrompt: "The sleep loop should sit naturally in the bedtime room and keep the moonlit background dogless.",
  },
  {
    id: "quiet-hours",
    label: "Quiet-hours sleep",
    motion: qaMotion("sleeping", "calm", "slow-breath", "Soft snooze."),
    expectedAction: "sleep-loop",
    expectedRoomVariant: "bedtime",
    expectedZone: "bed",
    expectedScenePhase: "rest",
    expectedNeed: "rest",
    nativeQaPrompt: "Quiet-hours sleep should feel like a soft game idle state, with no clipping at the bottom-center anchor.",
  },
  {
    id: "meal-logged",
    label: "Meal logged",
    motion: qaMotion("eating", "happy", "chew", "Meal logged."),
    expectedAction: "eat-loop",
    expectedRoomVariant: "day",
    expectedZone: "bowl",
    expectedScenePhase: "care-action",
    expectedNeed: "hunger",
    nativeQaPrompt: "Eating should route to the bowl zone and stay visually separate from the room art.",
  },
  {
    id: "water-logged",
    label: "Water logged",
    motion: qaMotion("drinking", "calm", "lap", "Water break."),
    expectedAction: "drink-loop",
    expectedRoomVariant: "day",
    expectedZone: "bowl",
    expectedScenePhase: "care-action",
    expectedNeed: "hydration",
    nativeQaPrompt: "Drinking should read as hydration at phone size, not as a generic idle loop.",
  },
  {
    id: "walk-logged",
    label: "Walk logged",
    motion: qaMotion("walking", "happy", "walk-cycle", "Walk logged."),
    expectedAction: "walk-loop",
    expectedRoomVariant: "day",
    expectedZone: "door",
    expectedScenePhase: "care-action",
    expectedNeed: "activity",
    nativeQaPrompt: "The walk loop should feel alive like a game sprite while remaining inside the room bounds.",
  },
  {
    id: "treat-win",
    label: "Treat or training win",
    motion: qaMotion("treat", "happy", "treat-hop", "Tiny celebration."),
    expectedAction: "celebrate-hop",
    expectedRoomVariant: "day",
    expectedZone: "rug",
    expectedScenePhase: "celebration",
    expectedNeed: "bond",
    nativeQaPrompt: "Celebration should feel rewarding without fake currency or visual clutter.",
  },
  {
    id: "health-watch",
    label: "Health Watch signal",
    motion: qaMotion("sick", "unwell", "health-watch", "Let's take it easy."),
    expectedAction: "health-watch",
    expectedRoomVariant: "healthWatch",
    expectedZone: "bed",
    expectedScenePhase: "watch",
    expectedNeed: "health",
    nativeQaPrompt: "Health Watch should be calm and non-diagnostic, using the health room without scary medical framing.",
  },
];

export function getCareTwinSpriteAsset(action: CareTwinSpriteAction): CareTwinSpriteAsset | null {
  return CARE_TWIN_SPRITE_ASSETS[action] ?? null;
}

export function getCareTwinRoomVariantKey(mood: Mood, action?: CareTwinSpriteAction): CareTwinRoomVariantKey {
  if (action === "sleep-loop") return "bedtime";
  if (action === "comfort-loop") return "homeAlone";
  if (action === "health-watch") return "healthWatch";
  if (action === "ear-perk" && mood === "anxious") return "night";
  return ROOM_VARIANT_BY_MOOD[mood] ?? "day";
}

export function getCareTwinRoomLayer(mood: Mood, action?: CareTwinSpriteAction): CareTwinRoomLayerAsset | null {
  return CARE_TWIN_ROOM_VARIANT_ASSETS[getCareTwinRoomVariantKey(mood, action)] ?? LEGACY_DAY_ROOM;
}

export function listCareTwinSpriteSlots(): CareTwinSpriteSlot[] {
  return Object.values(CARE_TWIN_SPRITE_MANIFEST).map((track) => ({
    action: track.key,
    expectedPath: track.requiredAsset,
    frameCount: track.frameCount,
    fps: track.fps,
    loop: track.loop,
    anchor: track.anchor,
    slotSize: track.slotSize,
    assetReady: Boolean(CARE_TWIN_SPRITE_ASSETS[track.key]),
  }));
}

export function getCareTwinLayerReadiness(
  action: CareTwinSpriteAction,
  mood: Mood,
): CareTwinLayerReadiness {
  const sprite = getCareTwinSpriteAsset(action);
  const room = getCareTwinRoomLayer(mood, action);
  const track = CARE_TWIN_SPRITE_MANIFEST[action];
  const missing: string[] = [];

  if (!room) missing.push("dogless-room-layer");
  if (!sprite) missing.push(track.requiredAsset);

  return {
    layeredReady: Boolean(sprite && room),
    spriteReady: Boolean(sprite),
    roomReady: Boolean(room),
    missing,
  };
}

export function listCareTwinRuntimeQaScenarios(): CareTwinRuntimeQaScenario[] {
  return CARE_TWIN_RUNTIME_QA_SCENARIOS.map((scenario) => ({ ...scenario }));
}

export function evaluateCareTwinRuntimeQaScenario(scenario: CareTwinRuntimeQaScenario): CareTwinRuntimeQaResult {
  const plan = deriveCareTwinScene(scenario.motion);
  const actualRoomVariant = getCareTwinRoomVariantKey(scenario.motion.avatarMood, plan.spriteAction);
  const actualZone = plan.zone;

  return {
    scenario,
    plan,
    actualAction: plan.spriteAction,
    actualRoomVariant,
    actualZone,
    actualScenePhase: plan.scenePhase,
    actualNeed: plan.priorityNeed,
    stageFraming: getCareTwinStageFraming(plan.spriteAction, actualZone),
    readiness: getCareTwinLayerReadiness(plan.spriteAction, scenario.motion.avatarMood),
  };
}
