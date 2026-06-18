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
    source: bundledAsset("assets/avatar/phoenix/tail-wag-strip.png", () =>
      require("@/assets/avatar/phoenix/tail-wag-strip.png"),
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
};

const DAY_ROOM: CareTwinRoomLayerAsset = {
  source: bundledAsset("assets/avatar/rooms/phoenix-room-day.png", () =>
    require("@/assets/avatar/rooms/phoenix-room-day.png"),
  ),
  description: "Dogless neo-retro Phoenix room with empty rug for layered sprite animation.",
};

export const CARE_TWIN_DOGLESS_ROOM_ASSETS: Partial<Record<Mood, CareTwinRoomLayerAsset>> = {
  happy: DAY_ROOM,
  excited: DAY_ROOM,
  calm: DAY_ROOM,
  anxious: DAY_ROOM,
  unwell: DAY_ROOM,
};

export function getCareTwinSpriteAsset(action: CareTwinSpriteAction): CareTwinSpriteAsset | null {
  return CARE_TWIN_SPRITE_ASSETS[action] ?? null;
}

export function getCareTwinRoomLayer(mood: Mood): CareTwinRoomLayerAsset | null {
  return CARE_TWIN_DOGLESS_ROOM_ASSETS[mood] ?? CARE_TWIN_DOGLESS_ROOM_ASSETS.calm ?? null;
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
  const room = getCareTwinRoomLayer(mood);
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
