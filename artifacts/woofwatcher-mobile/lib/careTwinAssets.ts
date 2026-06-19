import type { ImageSourcePropType } from "react-native";

import {
  CARE_TWIN_SPRITE_MANIFEST,
  type CareTwinSpriteAction,
  type CareTwinSpriteTrack,
} from "./avatarLifeEngine.ts";
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

function bundledAsset(path: string, source: () => ImageSourcePropType): ImageSourcePropType {
  return typeof require === "function" ? source() : { uri: path };
}

export const CARE_TWIN_SPRITE_ASSETS: Partial<Record<CareTwinSpriteAction, CareTwinSpriteAsset>> = {
  "idle-breathe": {
    source: bundledAsset("assets/avatar/phoenix/idle-breathe-strip.png", () =>
      require("@/assets/avatar/phoenix/idle-breathe-strip.png"),
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
    source: bundledAsset("assets/avatar/phoenix/ear-perk-strip.png", () =>
      require("@/assets/avatar/phoenix/ear-perk-strip.png"),
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
    source: bundledAsset("assets/avatar/phoenix/eat-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/eat-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "drink-loop": {
    source: bundledAsset("assets/avatar/phoenix/drink-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/drink-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "sleep-loop": {
    source: bundledAsset("assets/avatar/phoenix/sleep-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/sleep-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "comfort-loop": {
    source: bundledAsset("assets/avatar/phoenix/comfort-loop-strip.png", () =>
      require("@/assets/avatar/phoenix/comfort-loop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "celebrate-hop": {
    source: bundledAsset("assets/avatar/phoenix/celebrate-hop-strip.png", () =>
      require("@/assets/avatar/phoenix/celebrate-hop-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "health-watch": {
    source: bundledAsset("assets/avatar/phoenix/health-watch-strip.png", () =>
      require("@/assets/avatar/phoenix/health-watch-strip.png"),
    ),
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
  "bark-loop": {
    source: bundledAsset("assets/avatar/phoenix/pixellab-bark-south-strip.png", () =>
      require("@/assets/avatar/phoenix/pixellab-bark-south-strip.png"),
    ),
    columns: 6,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  },
};

export const CARE_TWIN_ROOM_VARIANT_ASSETS = {
  day: {
    source: bundledAsset("assets/avatar/rooms/phoenix-room-day.png", () =>
      require("@/assets/avatar/rooms/phoenix-room-day.png"),
    ),
    description: "Dogless neo-retro Phoenix day room with empty rug for layered sprite animation.",
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

export function getCareTwinSpriteAsset(action: CareTwinSpriteAction): CareTwinSpriteAsset | null {
  return CARE_TWIN_SPRITE_ASSETS[action] ?? null;
}

export function getCareTwinRoomLayer(mood: Mood, action?: CareTwinSpriteAction): CareTwinRoomLayerAsset | null {
  if (action === "sleep-loop") return BEDTIME_ROOM;
  if (action === "comfort-loop") return HOME_ALONE_ROOM;
  if (action === "health-watch") return HEALTH_WATCH_ROOM;
  if (action === "ear-perk" && mood === "anxious") return NIGHT_ROOM;
  return CARE_TWIN_DOGLESS_ROOM_ASSETS[mood] ?? LEGACY_DAY_ROOM;
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
